import {
  CreateStartUpPageContainer,
  EvenAppBridge,
  ListContainerProperty,
  ListItemContainerProperty,
  OsEventTypeList,
  RebuildPageContainer,
  StartUpPageCreateResult,
  TextContainerProperty,
  TextContainerUpgrade,
  ImageContainerProperty,
  ImageRawDataUpdate,
  waitForEvenAppBridge,
  type EvenHubEvent,
} from "@evenrealities/even_hub_sdk";
import {
  CONTAINER_IDS,
  CONTAINER_NAMES,
  GLASS_LAYOUT,
  TEXT_LAYOUT,
  TIMING,
} from "../config/constants";
import type {
  GestureEvent,
  GlassAdapter,
  GlassScreen,
  Unsubscribe,
} from "../types/contracts";

type ScreenKind = "textList" | "list" | "text" | "message" | "image" | null;

export class GlassAdapterImpl implements GlassAdapter {
  private bridge: EvenAppBridge | null = null;
  private unsubscribeHub: Unsubscribe | null = null;
  private startupDone = false;
  private currentScreenKind: ScreenKind = null;
  private readonly gestureHandlers = new Set<(e: GestureEvent) => void>();
  private lastScrollTime = 0;
  private imageCache = new Map<string, number[]>();

  async connect(): Promise<void> {
    if (this.bridge) return;
    this.bridge = await this.waitForBridge();
    this.bindEvents();
  }

  onGesture(handler: (event: GestureEvent) => void): Unsubscribe {
    this.gestureHandlers.add(handler);
    return () => {
      this.gestureHandlers.delete(handler);
    };
  }

  async showScreen(screen: GlassScreen): Promise<void> {
    switch (screen.kind) {
      case "textList":
        await this.renderTextList(screen.content, screen.actions, screen.footer, screen.theme);
        this.currentScreenKind = "textList";
        break;

      case "list":
        await this.renderList(screen.title, screen.items);
        this.currentScreenKind = "list";
        break;

      case "text":
        await this.renderText(screen.content);
        this.currentScreenKind = "text";
        break;
    }
  }

  async updateText(content: string): Promise<void> {
    if (!this.bridge) throw new Error("Not connected");

    await this.bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: CONTAINER_IDS.text,
        containerName: CONTAINER_NAMES.text,
        contentOffset: 0,
        contentLength: content.length,
        content: content.slice(0, 2000),
      }),
    );
  }

  async showMessage(text: string): Promise<void> {
    const msgContainer = new TextContainerProperty({
      xPosition: GLASS_LAYOUT.x,
      yPosition: GLASS_LAYOUT.y,
      width: GLASS_LAYOUT.textWidth,
      height: GLASS_LAYOUT.listFullHeight,
      containerID: CONTAINER_IDS.text,
      containerName: CONTAINER_NAMES.text,
      isEventCapture: 1,
      content: text.slice(0, 1000),
      borderWidth: 1,
      borderColor: 5,
      borderRdaius: 6,
      paddingLength: 8,
    });

    await this.renderContainers({ textObject: [msgContainer] });
    this.currentScreenKind = "message";
  }

  private async getOrFetchImage(url: string): Promise<number[]> {
    const fetchUrl = new URL(url, window.location.href).href;
    
    if (this.imageCache.has(fetchUrl)) {
      return this.imageCache.get(fetchUrl)!;
    }
    
    try {
      const response = await fetch(fetchUrl);
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('text/html')) {
        console.log(`[glass] Missing Image: Vite served HTML instead of image at ${fetchUrl}`);
        return [];
      }

      if (!response.ok) {
        console.log(`[glass] Missing Image: Server returned status ${response.status} for ${fetchUrl}`);
        return [];
      }
      
      // Pass the raw ArrayBuffer exactly like the Smart Cart example to preserve the 4-bit format
      const buffer = await response.arrayBuffer();
      const bytes = Array.from(new Uint8Array(buffer));
      
      this.imageCache.set(fetchUrl, bytes);
      return bytes;
    } catch (err) {
      console.log(`[glass] Missing Image: Network error fetching ${fetchUrl} - ${String(err)}`);
      return [];
    }
  }

  async showImageScreen(imageUrl: string): Promise<void> {
    if (!this.bridge) throw new Error("Not connected");

    const pngBytes = await this.getOrFetchImage(imageUrl);

    // Gracefully fallback to text if image bytes couldn't be loaded
    if (pngBytes.length === 0) {
      await this.showMessage("FITNESS HUD\n\nTap to select routine\nor start from phone");
      return;
    }

    const textContainer = new TextContainerProperty({
      xPosition: 0,
      yPosition: 0,
      width: 576,
      height: 288,
      borderWidth: 0,
      paddingLength: 0,
      containerID: CONTAINER_IDS.splashBg,
      containerName: CONTAINER_NAMES.splashBg,
      content: " ", 
      isEventCapture: 1,
    });

    const imageContainer = new ImageContainerProperty({
      xPosition: 188,
      yPosition: 94,
      width: 200,
      height: 100,
      containerID: CONTAINER_IDS.splashImg,
      containerName: CONTAINER_NAMES.splashImg,
    });

    // Rebuild the page with both the event capture layer and image layer
    await this.renderContainers({
      textObject: [textContainer],
      imageObject: [imageContainer],
    });
    this.currentScreenKind = "image";

    // Push the raw bytes immediately
    try {
      await this.bridge.updateImageRawData(
        new ImageRawDataUpdate({
          containerID: CONTAINER_IDS.splashImg,
          containerName: CONTAINER_NAMES.splashImg,
          imageData: pngBytes,
        }),
      );
    } catch (err) {
      console.log(`[glass] Failed to update image raw data: ${String(err)}`);
    }
  }

  // --- Private rendering ---

  private async renderTextList(
    content: string,
    actions: string[],
    footer?: string,
    theme?: "exercise" | "rest",
  ): Promise<void> {
    const footerText = footer?.trim() ?? "";
    const hasFooter = footerText.length > 0;
    const isRest = theme === "rest";

    const textContainer = new TextContainerProperty({
      xPosition: GLASS_LAYOUT.x,
      yPosition: GLASS_LAYOUT.y,
      width: GLASS_LAYOUT.textWidth,
      height: hasFooter ? GLASS_LAYOUT.textHeightWithFooter : GLASS_LAYOUT.textHeight,
      containerID: CONTAINER_IDS.text,
      containerName: CONTAINER_NAMES.text,
      isEventCapture: 0,
      content: content.slice(0, 1000),
      borderWidth: isRest ? 2 : 1,
      borderColor: isRest ? 13 : 5,
      borderRdaius: 6,
      paddingLength: 8,
    });

    const textContainers: TextContainerProperty[] = [textContainer];
    if (hasFooter) {
      textContainers.push(new TextContainerProperty({
        xPosition: GLASS_LAYOUT.footerX,
        yPosition: GLASS_LAYOUT.footerY,
        width: GLASS_LAYOUT.footerWidth,
        height: GLASS_LAYOUT.footerHeight,
        paddingLength: GLASS_LAYOUT.footerPadding,
        containerID: CONTAINER_IDS.footer,
        containerName: CONTAINER_NAMES.footer,
        isEventCapture: 0,
        content: this.rightAlignFooter(footerText).slice(0, 1000),
        borderWidth: 1,
        borderColor: 5,
        borderRdaius: 6,
      }));
    }

    const actionList = new ListContainerProperty({
      xPosition: hasFooter ? GLASS_LAYOUT.actionXWithFooter : GLASS_LAYOUT.x,
      yPosition: hasFooter ? GLASS_LAYOUT.actionYWithFooter : GLASS_LAYOUT.actionY,
      width: hasFooter ? GLASS_LAYOUT.actionWidthWithFooter : GLASS_LAYOUT.actionWidth,
      height: hasFooter ? GLASS_LAYOUT.actionHeightWithFooter : GLASS_LAYOUT.actionHeight,
      containerID: CONTAINER_IDS.action,
      containerName: CONTAINER_NAMES.action,
      isEventCapture: 1,
      borderWidth: 1,
      borderColor: 5,
      borderRdaius: 6,
      paddingLength: 4,
      itemContainer: new ListItemContainerProperty({
        itemCount: actions.length,
        itemName: actions,
        isItemSelectBorderEn: 1,
      }),
    });

    await this.renderContainers({
      textObject: textContainers,
      listObject: [actionList],
    });
  }

  private rightAlignFooter(text: string): string {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (!normalized) return "";

    const charWidthPx = GLASS_LAYOUT.textWidth / TEXT_LAYOUT.CHARS_PER_LINE;
    const usableWidthPx = Math.max(1, GLASS_LAYOUT.footerWidth - (GLASS_LAYOUT.footerPadding * 2));
    const maxChars = Math.max(1, Math.floor(usableWidthPx / charWidthPx));
    const clipped = normalized.length > maxChars ? normalized.slice(0, maxChars) : normalized;
    const leftPad = Math.max(0, maxChars - clipped.length);
    return `${" ".repeat(leftPad)}${clipped}`;
  }

  private async renderList(title: string, items: string[]): Promise<void> {
    const titleContainer = new TextContainerProperty({
      xPosition: GLASS_LAYOUT.x,
      yPosition: GLASS_LAYOUT.y,
      width: GLASS_LAYOUT.textWidth,
      height: 32,
      containerID: CONTAINER_IDS.text,
      containerName: CONTAINER_NAMES.text,
      isEventCapture: 0,
      content: title.slice(0, 1000),
    });

    const listContainer = new ListContainerProperty({
      xPosition: GLASS_LAYOUT.x,
      yPosition: GLASS_LAYOUT.y + 36,
      width: GLASS_LAYOUT.textWidth,
      height: GLASS_LAYOUT.listFullHeight - 36,
      containerID: CONTAINER_IDS.action,
      containerName: CONTAINER_NAMES.action,
      isEventCapture: 1,
      borderWidth: 1,
      borderColor: 5,
      borderRdaius: 6,
      paddingLength: 4,
      itemContainer: new ListItemContainerProperty({
        itemCount: items.length,
        itemName: items,
        isItemSelectBorderEn: 1,
      }),
    });

    await this.renderContainers({
      textObject: [titleContainer],
      listObject: [listContainer],
    });
  }

  private async renderText(content: string): Promise<void> {
    const textContainer = new TextContainerProperty({
      xPosition: GLASS_LAYOUT.x,
      yPosition: GLASS_LAYOUT.y,
      width: GLASS_LAYOUT.textWidth,
      height: GLASS_LAYOUT.listFullHeight,
      containerID: CONTAINER_IDS.text,
      containerName: CONTAINER_NAMES.text,
      isEventCapture: 1,
      content: content.slice(0, 1000),
      borderWidth: 1,
      borderColor: 5,
      borderRdaius: 6,
      paddingLength: 8,
    });

    await this.renderContainers({ textObject: [textContainer] });
  }

  private async renderContainers(payload: {
    listObject?: ListContainerProperty[];
    textObject?: TextContainerProperty[];
    imageObject?: ImageContainerProperty[];
  }): Promise<void> {
    if (!this.bridge) throw new Error("Not connected");

    const listCount = payload.listObject?.length ?? 0;
    const textCount = payload.textObject?.length ?? 0;
    const imageCount = payload.imageObject?.length ?? 0;
    const containerTotalNum = listCount + textCount + imageCount;

    const config: Record<string, any> = { containerTotalNum };
    if (listCount > 0) config.listObject = payload.listObject;
    if (textCount > 0) config.textObject = payload.textObject;
    if (imageCount > 0) config.imageObject = payload.imageObject;

    if (!this.startupDone) {
      const result = await this.bridge.createStartUpPageContainer(
        new CreateStartUpPageContainer(config as any),
      );

      if (result !== StartUpPageCreateResult.success) {
        throw new Error(`createStartUpPageContainer failed: ${String(result)}`);
      }

      this.startupDone = true;
      return;
    }

    let ok = await this.bridge.rebuildPageContainer(
      new RebuildPageContainer(config as any),
    );

    if (!ok) {
      await this.delay(300);
      ok = await this.bridge.rebuildPageContainer(
        new RebuildPageContainer(config as any),
      );
    }

    if (!ok) {
      console.warn("[glass] rebuildPageContainer failed after retry");
    }
  }

  // --- Event handling ---

  private bindEvents(): void {
    if (!this.bridge) return;

    this.unsubscribeHub?.();
    this.unsubscribeHub = this.bridge.onEvenHubEvent((event) => {
      const gesture = this.mapEventToGesture(event);
      if (!gesture) return;

      if (gesture.kind === "SCROLL_FWD" || gesture.kind === "SCROLL_BACK") {
        const now = Date.now();
        if (now - this.lastScrollTime < TIMING.SCROLL_COOLDOWN_MS) return;
        this.lastScrollTime = now;
      }

      for (const handler of this.gestureHandlers) {
        handler(gesture);
      }
    });
  }

  private mapEventToGesture(event: EvenHubEvent): GestureEvent | null {
    const eventType =
      event.listEvent?.eventType ??
      event.textEvent?.eventType ??
      event.sysEvent?.eventType;

    if (eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
      return { kind: "SCROLL_FWD" };
    }
    if (eventType === OsEventTypeList.SCROLL_TOP_EVENT) {
      return { kind: "SCROLL_BACK" };
    }
    if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      return { kind: "DOUBLE_TAP" };
    }
    if (eventType === OsEventTypeList.CLICK_EVENT || eventType === undefined) {
      return {
        kind: "TAP",
        listIndex: event.listEvent?.currentSelectItemIndex,
      };
    }
    if (eventType === OsEventTypeList.FOREGROUND_ENTER_EVENT) {
      return { kind: "FOREGROUND_ENTER" };
    }
    if (eventType === OsEventTypeList.FOREGROUND_EXIT_EVENT) {
      return { kind: "FOREGROUND_EXIT" };
    }
    if (eventType === OsEventTypeList.ABNORMAL_EXIT_EVENT) {
      return { kind: "FOREGROUND_EXIT" };
    }

    return null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async waitForBridge(): Promise<EvenAppBridge> {
    let timer: ReturnType<typeof setTimeout> | null = null;

    try {
      const bridge = await Promise.race([
        waitForEvenAppBridge(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error("Timed out waiting for Even bridge."));
          }, TIMING.BRIDGE_TIMEOUT_MS);
        }),
      ]);
      return bridge;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}