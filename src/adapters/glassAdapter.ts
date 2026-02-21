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

type ScreenKind = "textList" | "list" | "text" | "message" | null;

/**
 * GlassAdapter for the Gym app — TUI-style mixed text+list containers.
 *
 * Screen types:
 * - TextListScreen: text container (top) + list container (bottom actions)
 *   with optional non-interactive footer text appended in the text container
 * - ListScreen: full-page list container (routine selection)
 * - TextScreen: single text container
 *
 * Handles all known SDK quirks:
 * - CLICK_EVENT=0 → undefined
 * - 300ms scroll cooldown
 * - rebuildPageContainer retry after 300ms
 * - Content sliced to 1000/2000 char limits
 * - Short container names (~6 chars)
 */
export class GlassAdapterImpl implements GlassAdapter {
  private bridge: EvenAppBridge | null = null;
  private unsubscribeHub: Unsubscribe | null = null;
  private startupDone = false;
  private currentScreenKind: ScreenKind = null;
  private readonly gestureHandlers = new Set<(e: GestureEvent) => void>();
  private lastScrollTime = 0;

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

  /**
   * Show a screen on the glasses. Always triggers a full rebuild
   * because list containers cannot be updated in-place.
   */
  async showScreen(screen: GlassScreen): Promise<void> {
    switch (screen.kind) {
      case "textList":
        await this.renderTextList(screen.content, screen.actions, screen.footer);
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

  /**
   * Lightweight in-place text update for timer ticks.
   * Only updates the text container — list container stays unchanged.
   * Max 2000 chars.
   */
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

  /**
   * Show a simple full-screen text message (idle, error, etc).
   */
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
    });

    await this.renderContainers({ textObject: [msgContainer] });
    this.currentScreenKind = "message";
  }

  // --- Private rendering ---

  /**
   * Render text + list layout:
   * - Text container at top (info/timer content, isEventCapture=0)
   * - List container at bottom (action items like Done/Skip, isEventCapture=1)
   * - Optional footer text container on the same row as actions (isEventCapture=0)
   */
  private async renderTextList(
    content: string,
    actions: string[],
    footer?: string,
  ): Promise<void> {
    const footerText = footer?.trim() ?? "";
    const hasFooter = footerText.length > 0;
    const textContainer = new TextContainerProperty({
      xPosition: GLASS_LAYOUT.x,
      yPosition: GLASS_LAYOUT.y,
      width: GLASS_LAYOUT.textWidth,
      height: hasFooter ? GLASS_LAYOUT.textHeightWithFooter : GLASS_LAYOUT.textHeight,
      containerID: CONTAINER_IDS.text,
      containerName: CONTAINER_NAMES.text,
      isEventCapture: 0,
      content: content.slice(0, 1000),
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

  /**
   * Right-align footer text within the footer container.
   * SDK text containers do not expose a text-align option, so we pad to fit.
   */
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

  /**
   * Render full-page list (routine selection).
   * Title is placed as a text container at the top, list below.
   */
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

  /**
   * Render single text container.
   */
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
    });

    await this.renderContainers({ textObject: [textContainer] });
  }

  /**
   * Unified container rendering. Uses createStartUpPageContainer on first call,
   * rebuildPageContainer on subsequent calls (with retry on failure).
   */
  private async renderContainers(payload: {
    listObject?: ListContainerProperty[];
    textObject?: TextContainerProperty[];
  }): Promise<void> {
    if (!this.bridge) throw new Error("Not connected");

    const containerTotalNum =
      (payload.listObject?.length ?? 0) + (payload.textObject?.length ?? 0);

    const config = {
      containerTotalNum,
      ...(payload.listObject ? { listObject: payload.listObject } : {}),
      ...(payload.textObject ? { textObject: payload.textObject } : {}),
    };

    if (!this.startupDone) {
      const result = await this.bridge.createStartUpPageContainer(
        new CreateStartUpPageContainer(config),
      );

      if (result !== StartUpPageCreateResult.success) {
        throw new Error(`createStartUpPageContainer failed: ${String(result)}`);
      }

      this.startupDone = true;
      return;
    }

    let ok = await this.bridge.rebuildPageContainer(
      new RebuildPageContainer(config),
    );

    if (!ok) {
      await this.delay(300);
      ok = await this.bridge.rebuildPageContainer(
        new RebuildPageContainer(config),
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
    // CLICK_EVENT = 0 becomes undefined during SDK deserialization
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

  // --- Utilities ---

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
