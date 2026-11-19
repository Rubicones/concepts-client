import { describe, expect, it } from "vitest";
import { ALL_QUESTION_IDS, DECIDE, SEC, questionById } from "./schema";
import {
  addClient,
  answered,
  blankState,
  brandsForApproval,
  catOf,
  checklistDone,
  clientName,
  demoFill,
  exportAnswers,
  exportQuestions,
  importAnswers,
  isKeyUnlocked,
  legalOk,
  makeCtx,
  missingForSend,
  pickChip,
  removeClient,
  reviewSummary,
  secStatus,
  setAnswer,
  setPair,
  setRole,
  slugToStep,
  stepSlug,
  steps,
  toggleMood,
  toggleMoodDecide,
  toggleStar,
  totals,
  visible,
  type QState,
} from "./logic";

const q = (id: string) => questionById(id)!;
const brand = (a: Record<string, unknown> = {}): QState => ({ ...blankState(), role: "brand", mode: "self", a });
const agency = (a: Record<string, unknown> = {}, clients = [{ id: "c1" }]): QState => ({ ...blankState(), role: "agency", mode: "self", a, clients });
const visibleIds = (s: QState, sec: string, scope: string | null = null) => SEC[sec].qs.filter((x) => visible(s, scope, x)).map((x) => x.id);

describe("schema", () => {
  it("keeps every prototype question id (the contract with Forma)", () => {
    expect(ALL_QUESTION_IDS).toHaveLength(new Set(ALL_QUESTION_IDS).size);
    // Spot-check ids from each section of the prototype.
    for (const id of ["c_company", "c_brand", "c_where_c", "p_list", "a_life_text", "m_diff", "d_main", "k_langs", "kp_naming", "k_deliver", "v_pairs", "v_gen", "f_drop", "f_nobook", "g_name", "g_brief"]) {
      expect(ALL_QUESTION_IDS).toContain(id);
    }
    expect(ALL_QUESTION_IDS.length).toBe(111); // as many Q() as the prototype
  });
});

describe("steps", () => {
  it("brand order", () => {
    expect(steps(brand())).toEqual(["welcome", "company", "product", "people", "market", "ads", "make", "vibe", "files", "legal", "review"]);
  });
  it("agency: one block per client", () => {
    const s = agency({}, [{ id: "c1" }, { id: "c7" }]);
    const st = steps(s);
    expect(st.slice(0, 3)).toEqual(["welcome", "agency", "c1|company"]);
    expect(st).toContain("c7|files");
    expect(st.slice(-2)).toEqual(["legal", "review"]);
    expect(st).toHaveLength(2 + 16 + 2);
  });
  it("deep links round-trip like the prototype's hash", () => {
    const s = agency();
    expect(stepSlug("c1|company")).toBe("c1-company");
    expect(slugToStep("c1-company", s)).toBe("c1|company");
    expect(slugToStep("nope", s)).toBeNull();
  });
});

describe("visibility", () => {
  it("B2C, B2B and Both show their own questions", () => {
    const none = visibleIds(brand(), "people");
    expect(none).not.toContain("a_gender");
    expect(none).not.toContain("a_b_ind");
    const c = visibleIds(brand({ c_buyers: "People (B2C)" }), "people");
    expect(c).toContain("a_gender");
    expect(c).not.toContain("a_b_ind");
    const b = visibleIds(brand({ c_buyers: "Businesses (B2B)" }), "people");
    expect(b).not.toContain("a_gender");
    expect(b).toContain("a_b_who");
    const both = visibleIds(brand({ c_buyers: "Both" }), "people");
    expect(both).toContain("a_gender");
    expect(both).toContain("a_b_who");
  });
  it("conditional follow-ups", () => {
    expect(visibleIds(brand({ c_other: "Yes" }), "company")).toContain("c_other_list");
    expect(visibleIds(brand({ c_other: "No" }), "company")).not.toContain("c_other_list");
    expect(visibleIds(brand({ d_goals: ["More sales"] }), "ads")).not.toContain("d_main");
    expect(visibleIds(brand({ d_goals: ["More sales", "Get known"] }), "ads")).toContain("d_main");
    expect(visibleIds(brand({ d_channels: ["Not advertising yet"] }), "ads")).not.toContain("d_examples");
    expect(visibleIds(brand({ d_when: "Nothing planned yet" }), "ads")).not.toContain("d_next");
    expect(visibleIds(brand({ k_what: [DECIDE] }), "make")).toContain("k_len");
    expect(visibleIds(brand({ k_what: ["Static ads"] }), "make")).not.toContain("k_sound");
    expect(visibleIds(brand({ m_proof: ["Nothing yet"] }), "market")).not.toContain("m_proof_note");
    expect(visibleIds(brand({ a_groups: "2–3", c_buyers: "People (B2C)" }), "people")).toContain("a_groups_note");
  });
  it("agency-only questions appear only inside a client; brand-only ones never for agencies", () => {
    expect(visibleIds(brand(), "make")).not.toContain("kp_vary");
    expect(visibleIds(brand(), "make")).toContain("k_approve");
    expect(visibleIds(agency(), "make", "c1")).toContain("kp_vary");
    expect(visibleIds(agency(), "make", "c1")).not.toContain("k_approve");
  });
  it("half partners never render on their own", () => {
    expect(visibleIds(brand(), "company")).not.toContain("c_brand");
  });
  it("labels follow the role and scope", () => {
    const s = agency({ "c1:c_buyers": "Businesses (B2B)" });
    expect((SEC.company.title as (c: ReturnType<typeof makeCtx>) => string)(makeCtx(s, "c1"))).toBe("Your client");
    const ph = q("c_what").ph as (c: ReturnType<typeof makeCtx>) => string;
    expect(ph(makeCtx(s, "c1"))).toBe("e.g. We make hiring software for retail chains.");
    const diff = q("m_diff").label as (c: ReturnType<typeof makeCtx>) => string;
    expect(diff(makeCtx(brand({ m_comp: [{ a: "Acme" }, { a: "" }, { a: "Globex" }] }), null))).toBe("How are you different from Acme, Globex?");
  });
});

describe("completion", () => {
  it("special answered rules", () => {
    expect(answered(brand({ p_list: [{ b: "only a description" }] }), null, q("p_list"))).toBe(false);
    expect(answered(brand({ p_list: [{ a: "Plan" }] }), null, q("p_list"))).toBe(true);
    expect(answered(brand({ v_pairs: { warm: 2, volume: 3, texture: 1, tone: 5, novelty: "decide" } }), null, q("v_pairs"))).toBe(false);
    expect(answered(brand({ v_pairs: { warm: 2, volume: 3, texture: 1, tone: 5, novelty: "decide", price: 4 } }), null, q("v_pairs"))).toBe(true);
    expect(answered(brand({ c_markets_world: true }), null, q("c_markets"))).toBe(true);
    expect(answered(brand({ v_mood_decide: true }), null, q("v_mood"))).toBe(true);
    expect(answered(brand({ c_industry: [] }), null, q("c_industry"))).toBe(false);
  });
  it("counts required answers per section, only visible ones", () => {
    const empty = secStatus(brand(), "company", null);
    // company, site, what, industry, buyers, markets, langs, size, pay, other (B2C/B2B lists hidden until "Who buys")
    expect(empty.req).toBe(10);
    const withB2c = secStatus(brand({ c_buyers: "People (B2C)" }), "company", null);
    expect(withB2c.req).toBe(empty.req + 1);
    expect(withB2c.done).toBe(1);
    const both = secStatus(brand({ c_buyers: "Both" }), "company", null);
    expect(both.req).toBe(empty.req + 2);
  });
  it("legal counts as 3 and needs name, company, terms and an NDA (or our own)", () => {
    const s = brand();
    expect(secStatus(s, "legal", null)).toMatchObject({ req: 3, done: 0 });
    const sig = { by: "Ana", company: "Kite", at: "x", docVersion: "nda.v1", documentHash: "h", userAgent: null };
    const partial = { ...s, legal: { name: "Ana", company: "Kite", nda: sig } };
    expect(secStatus(partial, "legal", null).done).toBe(1);
    expect(legalOk({ ...partial, legal: { ...partial.legal, terms: { ...sig, docVersion: "terms.v1" } } })).toBe(true);
    expect(legalOk({ ...s, legal: { name: "Ana", company: "Kite", ndaOwn: true, terms: sig } })).toBe(true);
  });
  it("totals add every step; send needs everything", () => {
    const t = totals(brand());
    expect(t.done).toBe(0);
    expect(t.req).toBeGreaterThan(40);
    const miss = missingForSend(brand());
    expect(miss.some((m) => m.key === "c_company")).toBe(true);
    expect(miss.some((m) => m.label === "NDA and terms")).toBe(true);
    expect(missingForSend(blankState())[0].key).toBe("role");
  });
});

describe("chips", () => {
  it("single choice toggles", () => {
    let s = pickChip(brand(), null, q("c_buyers"), "Both").state;
    expect(s.a.c_buyers).toBe("Both");
    s = pickChip(s, null, q("c_buyers"), "Both").state;
    expect(s.a.c_buyers).toBeUndefined();
  });
  it("max refuses the extra pick with the prototype's message", () => {
    let s = brand();
    for (const o of ["Price", "Quality", "Service"]) s = pickChip(s, null, q("p_why"), o).state;
    const r = pickChip(s, null, q("p_why"), "Speed");
    expect(r.error).toBe("Up to 3 — tap one to swap");
    expect(r.state.a.p_why).toEqual(["Price", "Quality", "Service"]);
  });
  it("exclusive options and Up to you replace the rest, and the rest replace them", () => {
    let s = pickChip(brand(), null, q("a_doubt"), "Too expensive").state;
    s = pickChip(s, null, q("a_doubt"), "Not sure").state;
    expect(s.a.a_doubt).toEqual(["Not sure"]);
    s = pickChip(s, null, q("a_doubt"), "No urgent need").state;
    expect(s.a.a_doubt).toEqual(["No urgent need"]);
    s = pickChip(s, null, q("k_formats"), "Square 1:1").state;
    s = pickChip(s, null, q("k_formats"), DECIDE).state;
    expect(s.a.k_formats).toEqual([DECIDE]);
  });
  it("dropping a goal clears the main goal when it was that one", () => {
    let s = brand({ d_goals: ["More sales", "Get known"], d_main: "Get known" });
    s = pickChip(s, null, q("d_goals"), "Get known").state;
    expect(s.a.d_main).toBeUndefined();
  });
  it("editing an answer clears its 'check' flag", () => {
    const s = { ...brand({ c_size: "1–10" }), flags: { c_size: "file" as const } };
    expect(pickChip(s, null, q("c_size"), "11–50").state.flags.c_size).toBeUndefined();
  });
  it("scopes agency client answers", () => {
    const s = pickChip(agency(), "c1", q("c_buyers"), "Both").state;
    expect(s.a["c1:c_buyers"]).toBe("Both");
    expect(s.a.c_buyers).toBeUndefined();
  });
});

describe("other inputs", () => {
  it("stars up to 3", () => {
    let s = brand({ p_list: [{ a: "A" }, { a: "B" }, { a: "C" }, { a: "D" }] });
    for (const i of [0, 1, 2]) s = toggleStar(s, null, "p_list", i).state;
    expect(toggleStar(s, null, "p_list", 3).error).toBe("Star up to 3");
  });
  it("mood: up to 3, Up to you clears picks, picks clear Up to you and the not-you twin", () => {
    let s = brand({ v_not: "studio" });
    s = toggleMood(s, null, "studio").state;
    expect(s.a.v_not).toBeUndefined();
    s = toggleMood(s, null, "type").state;
    s = toggleMood(s, null, "ui").state;
    expect(toggleMood(s, null, "toy").error).toBe("Up to 3 — tap one to swap");
    s = toggleMoodDecide(s, null);
    expect(s.a.v_mood).toEqual([]);
    s = toggleMood(s, null, "toy").state;
    expect(s.a.v_mood_decide).toBe(false);
  });
  it("pairs: Up to you toggles", () => {
    let s = setPair(brand(), null, "warm", "decide");
    expect((s.a.v_pairs as Record<string, unknown>).warm).toBe("decide");
    s = setPair(s, null, "warm", "decide");
    expect((s.a.v_pairs as Record<string, unknown>).warm).toBeUndefined();
  });
  it("clients: add, name, remove with their answers", () => {
    let s = agency({ "c1:c_company": "Kite" });
    const added = addClient(s);
    s = setAnswer(added.state, added.id, "c_company", "Hearth");
    expect(added.id).toBe("c2");
    expect(clientName(s, "c2")).toBe("Hearth");
    expect(brandsForApproval(s)).toEqual([
      { name: "Kite", questionnaire_scope: "c1" },
      { name: "Hearth", questionnaire_scope: "c2" },
    ]);
    s = removeClient(s, "c2");
    expect(s.a["c2:c_company"]).toBeUndefined();
    expect(removeClient(s, "c1").clients).toHaveLength(1);
  });
  it("switching role keeps both branches' answers", () => {
    const s = setRole(brand({ c_company: "Kite" }), "agency");
    expect(s.a.c_company).toBe("Kite");
    expect(setRole(s, "brand").a.c_company).toBe("Kite");
  });
});

describe("review", () => {
  it("collects Up to you and unsure answers", () => {
    const s = brand({ k_formats: [DECIDE], m_known: "Hard to say", v_pairs: { warm: "decide" }, a_doubt: ["Not sure"], c_buyers: "People (B2C)" });
    const r = reviewSummary(s);
    expect(r.decide).toEqual(expect.arrayContaining(["Formats", "Where does your brand sit?"]));
    expect(r.unsure).toEqual(expect.arrayContaining(["How well do people know you?", "What stops people from buying?"]));
    expect(r.items.map((i) => i.step)).toEqual(steps(s).filter((x) => x !== "welcome" && x !== "review"));
  });
});

describe("AI assistant", () => {
  it("exports questions with ids and options", () => {
    const md = exportQuestions(brand());
    expect(md).toContain("### [c_company] Company name");
    expect(md).toContain("### [c_brand] Brand name");
    expect(md).toContain("Options (pick any, up to 3): Price · Quality");
    expect(md).toContain("Options (pick one): No · Yes");
    expect(md).not.toContain("[v_pairs]");
    expect(md).not.toContain("[kp_vary]");
    expect(exportQuestions(agency())).toContain("### [kp_vary]");
    expect(exportQuestions(agency())).toContain("## Your agency");
  });

  it("imports answers and marks them for checking", () => {
    const reply = [
      "### [c_company] Company name\nAnswer: Northwind\n",
      "### [c_buyers] Who buys from you?\nAnswer: People (B2C)\n",
      "### [c_industry] Industry\nAnswer: Finance & fintech, Apps & software\n",
      "### [c_markets] Where do you sell?\nAnswer: United Kingdom, Germany and Spain\n",
      "### [p_why] Why do customers choose you?\nAnswer: Price, Quality, Service, Speed\n",
      "### [p_list] Your main products or services\nAnswer:\n- Saver — automatic savings\n- Pots: goals for the family\n",
      "### [c_size] How big is the team?\nAnswer: Not sure\n",
      "### [nope] Unknown\nAnswer: x\n",
    ].join("\n");
    const { state, count } = importAnswers(brand(), reply);
    expect(state.a.c_company).toBe("Northwind");
    expect(state.a.c_buyers).toBe("People (B2C)");
    expect(state.a.c_industry).toEqual(["Finance & fintech", "Apps & software"]);
    expect(state.a.c_markets).toEqual(["United Kingdom", "Germany", "Spain"]);
    expect(state.a.p_why).toEqual(["Price", "Quality", "Service"]);
    expect(state.a.p_list).toEqual([
      { a: "Saver", b: "automatic savings" },
      { a: "Pots", b: "goals for the family" },
    ]);
    expect(state.a.c_size).toBeUndefined();
    expect(state.flags.c_company).toBe("file");
    expect(count).toBe(6);
  });

  it("imports into the first client for agencies, agency fields at the top", () => {
    const { state } = importAnswers(agency(), "### [g_name] Agency name\nAnswer: Blue Harbor\n\n### [c_company] Client\nAnswer: Kite\n");
    expect(state.a.g_name).toBe("Blue Harbor");
    expect(state.a["c1:c_company"]).toBe("Kite");
  });

  it("exports answers as plain text", () => {
    const out = exportAnswers(brand({ c_company: "Kite", c_brand: "Kite Pay", p_list: [{ a: "Card", b: "Free", s: true }] }));
    expect(out).toContain("Company name: Kite");
    expect(out).toContain("Brand name: Kite Pay");
    expect(out).toContain("Your main products or services: Card — Free ★");
  });

  it("demo pre-fill never overwrites and marks answers 'from our call'", () => {
    const s = demoFill(brand({ c_company: "Mine" }));
    expect(s.a.c_company).toBe("Mine");
    expect(s.a.c_site).toBe("https://northwind.example");
    expect(s.flags.c_site).toBe("prefill");
    expect(s.flags.c_company).toBeUndefined();
  });
});

describe("files", () => {
  it("sorts files like the prototype", () => {
    expect(catOf("Client brief.docx")).toBe("Briefs");
    expect(catOf("Inter.woff2")).toBe("Fonts");
    expect(catOf("logo-dark.png")).toBe("Logos");
    expect(catOf("mark.svg")).toBe("Logos");
    expect(catOf("Brand Guidelines.pdf")).toBe("Brand book");
    expect(catOf("price list.xlsx")).toBe("Catalog");
    expect(catOf("spring-campaign.mp4")).toBe("Past ads");
    expect(catOf("factory.mov")).toBe("Video");
    expect(catOf("app-screen.png")).toBe("Product screens");
    expect(catOf("banner_v2.jpg")).toBe("Past ads");
    expect(catOf("team.jpg")).toBe("Photos");
    expect(catOf("source.fig")).toBe("Source files");
    expect(catOf("everything.zip")).toBe("Archives (we unpack)");
    expect(catOf("notes.pdf")).toBe("Documents");
    expect(catOf("weird.bin")).toBe("Other");
  });
  it("checklist counts product screens as photos", () => {
    expect(checklistDone(["Product screens"], "Photos")).toBe(true);
    expect(checklistDone(["Logos"], "Fonts")).toBe(false);
  });
});

describe("unlocking for follow-up questions", () => {
  it("unlocks the answer and its parts only", () => {
    const u = ["c1:c_industry", "c_markets", "c1:v_mood", "c_company"];
    expect(isKeyUnlocked("c1:c_industry", u)).toBe(true);
    expect(isKeyUnlocked("c1:c_industry__other", u)).toBe(true);
    expect(isKeyUnlocked("c_markets_world", u)).toBe(true);
    expect(isKeyUnlocked("c1:v_mood_decide", u)).toBe(true);
    expect(isKeyUnlocked("c_brand", u)).toBe(true);
    expect(isKeyUnlocked("c_industry", u)).toBe(false);
    expect(isKeyUnlocked("c1:c_site", u)).toBe(false);
  });
});
