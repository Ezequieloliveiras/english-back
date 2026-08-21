import { describe, expect, it } from "@jest/globals";
import { selectSemanticContext } from "../services/contentDiversity.service";

describe("daily semantic context selection", () => {
  it("rejects a recent work context before varying the selection", () => {
    const selected = selectSemanticContext({
      userId: "learner-1",
      date: "2026-08-21",
      level: "A2",
      module: "listening",
      recent: [{
        topic: "work", subtopic: "team_update", scenario: "sharing_a_status_update",
        communicativeGoal: "giving_an_update", setting: "team meeting",
        participants: ["employee", "team lead"], keywords: ["update", "task", "finish", "tomorrow"],
      }],
    });
    expect(selected.topic).not.toBe("work");
  });

  it("selects a substantially different context on the next day when the prior semantic metadata is known", () => {
    const first = selectSemanticContext({ userId: "learner-2", date: "2026-08-21", level: "A2", module: "shadowing", recent: [] });
    const second = selectSemanticContext({ userId: "learner-2", date: "2026-08-22", level: "A2", module: "shadowing", recent: [first] });
    expect(`${second.topic}|${second.subtopic}|${second.scenario}`).not.toBe(`${first.topic}|${first.subtopic}|${first.scenario}`);
  });
});
