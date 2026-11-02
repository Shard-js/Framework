import { describe, it, expect, vi } from "vitest";
import { Paginator, EmbedBuilder, ButtonStyle } from "../src/index.js";

describe("Paginator Component Helper", () => {
  it("initializes with embeds and generates navigation buttons", () => {
    const e1 = new EmbedBuilder().setTitle("Page 1");
    const e2 = new EmbedBuilder().setTitle("Page 2");
    const e3 = new EmbedBuilder().setTitle("Page 3");

    const paginator = new Paginator({
      embeds: [e1, e2, e3],
      customIdPrefix: "test_page",
    });

    expect(paginator.currentPage).toBe(0);
    expect(paginator.embeds).toHaveLength(3);

    const row = paginator.getActionRow();
    const json = row.toJSON();

    // 5 buttons: First, Prev, Indicator, Next, Last
    expect(json.components).toHaveLength(5);
    expect(json.components![0].disabled).toBe(true); // First disabled on page 0
    expect(json.components![1].disabled).toBe(true); // Prev disabled on page 0
    expect(json.components![2].label).toBe("1 / 3");
    expect(json.components![3].disabled).toBe(false); // Next enabled
    expect(json.components![4].disabled).toBe(false); // Last enabled
  });

  it("handles button actions correctly", () => {
    const paginator = new Paginator({
      embeds: [
        { title: "P1" },
        { title: "P2" },
        { title: "P3" },
      ],
      customIdPrefix: "my_pager",
    });

    expect(paginator.handleButton("my_pager_next")).toBe(true);
    expect(paginator.currentPage).toBe(1);

    expect(paginator.handleButton("my_pager_next")).toBe(true);
    expect(paginator.currentPage).toBe(2);

    // Cannot advance past last page
    expect(paginator.handleButton("my_pager_next")).toBe(false);
    expect(paginator.currentPage).toBe(2);

    // Prev
    expect(paginator.handleButton("my_pager_prev")).toBe(true);
    expect(paginator.currentPage).toBe(1);

    // First
    expect(paginator.handleButton("my_pager_first")).toBe(true);
    expect(paginator.currentPage).toBe(0);

    // Last
    expect(paginator.handleButton("my_pager_last")).toBe(true);
    expect(paginator.currentPage).toBe(2);

    // Non-matching customId
    expect(paginator.handleButton("other_btn")).toBe(false);
  });

  it("sends reply or editReply through interaction", async () => {
    const paginator = new Paginator({
      embeds: [{ title: "Single" }],
    });

    let sentPayload: any = null;
    const mockInteraction: any = {
      replied: false,
      deferred: false,
      reply: async (opts: any) => {
        sentPayload = opts;
      },
    };

    await paginator.send(mockInteraction);
    expect(sentPayload).toBeDefined();
    expect(sentPayload.embeds[0].title).toBe("Single");
    // Single embed doesn't need component navigation
    expect(sentPayload.components).toBeUndefined();
  });
});
