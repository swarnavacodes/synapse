const base = "http://localhost:4000/api";

let checksRun = 0;
let checksPassed = 0;
function check(name, cond, extra) {
  checksRun++;
  if (cond) {
    checksPassed++;
    console.log(`  ✓ ${name}`);
  } else {
    console.log(`  ✗ ${name}${extra ? ` :: ${extra}` : ""}`);
    throw new Error(`check failed: ${name}`);
  }
}

async function main() {
  // ---------- PHASE 1: core CRUD + graph + validation ----------
  console.log("PHASE 1: core CRUD");

  const r = await fetch(`${base}/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Smoke test" }),
  });
  const session = await r.json();
  console.log("  created session:", session.id);

  const c1Res = await fetch(`${base}/sessions/${session.id}/concepts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      label: "Consciousness",
      category: "philosophy",
      summary: "the state of being aware",
    }),
  });
  const c1 = await c1Res.json();

  const c2Res = await fetch(`${base}/sessions/${session.id}/concepts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      label: "Qualia",
      category: "philosophy",
      summary: "subjective experiences",
    }),
  });
  const c2 = await c2Res.json();

  const relRes = await fetch(`${base}/sessions/${session.id}/relationships`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sourceId: c1.id,
      targetId: c2.id,
      type: "part_of",
      kind: "interpretation",
      explanation: "qualia are parts of consciousness",
      strength: 0.8,
    }),
  });
  const rel = await relRes.json();
  check("relationship created", rel.id);

  const graphRes = await fetch(`${base}/sessions/${session.id}`);
  const graph = await graphRes.json();
  check("reloaded 2 concepts", graph.concepts.length === 2, `got ${graph.concepts.length}`);
  check("reloaded 1 relationship", graph.relationships.length === 1, `got ${graph.relationships.length}`);

  const positionRes = await fetch(`${base}/sessions/${session.id}/positions`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ [c1.id]: { x: 120, y: 240 } }),
  });
  check("save positions returns 204", positionRes.status === 204, `got ${positionRes.status}`);
  const positionedGraph = await (await fetch(`${base}/sessions/${session.id}`)).json();
  check("positions persisted", positionedGraph.positions?.[c1.id]?.x === 120);

  const bad = await fetch(`${base}/sessions/${session.id}/relationships`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sourceId: c1.id,
      targetId: c1.id,
      type: "related_to",
      kind: "fact",
    }),
  });
  check("self-loop returns 400", bad.status === 400, `got ${bad.status}`);
  const errBody = await bad.json();
  check("self-loop code = self_loop", errBody.error?.code === "self_loop");

  const invalid = await fetch(`${base}/sessions/${session.id}/concepts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ label: "" }),
  });
  check("empty label returns 400", invalid.status === 400, `got ${invalid.status}`);
  const errBody2 = await invalid.json();
  check("invalid body code = invalid_body", errBody2.error?.code === "invalid_body");

  const delRes = await fetch(`${base}/sessions/${session.id}/concepts/${c1.id}`, {
    method: "DELETE",
  });
  check("delete returns 204", delRes.status === 204, `got ${delRes.status}`);
  const afterRes = await fetch(`${base}/sessions/${session.id}`);
  const after = await afterRes.json();
  check(
    "cascade delete removed relationship",
    after.concepts.length === 1 && after.relationships.length === 0,
    `concepts=${after.concepts.length} rels=${after.relationships.length}`
  );

  // ---------- PHASE 2: LLM expand (only if API key is configured) ----------
  console.log("\nPHASE 2: LLM expand");
  if (!process.env.OPENROUTER_API_KEY) {
    console.log("  ⊘ SKIPPED (no OPENROUTER_API_KEY in env)");
  } else {
    // Build a small neighborhood so the LLM has signal.
    const seedRes = await fetch(`${base}/sessions/${session.id}/concepts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label: "Neural correlates of consciousness",
        category: "neuroscience",
        summary: "minimal neural mechanisms sufficient for conscious experience",
      }),
    });
    const seed = await seedRes.json();
    console.log("  created seed concept:", seed.id);

    // Create a 1-hop neighbour so the prompt has context.
    const nbrRes = await fetch(`${base}/sessions/${session.id}/concepts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label: "Global workspace theory",
        category: "neuroscience",
        summary: "consciousness arises from broadcast integration across brain regions",
      }),
    });
    const nbr = await nbrRes.json();
    await fetch(`${base}/sessions/${session.id}/relationships`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceId: seed.id,
        targetId: nbr.id,
        type: "related_to",
        kind: "interpretation",
        explanation: "closely related theoretical frameworks",
        strength: 0.7,
      }),
    });

    const before = await (await fetch(`${base}/sessions/${session.id}`)).json();
    const beforeConcepts = before.concepts.length;
    const beforeRels = before.relationships.length;

    const expandRes = await fetch(`${base}/sessions/${session.id}/expand`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nodeId: seed.id, depth: 1 }),
    });

    if (expandRes.status === 503) {
      const err = await expandRes.json();
      if (err.error?.code === "llm_not_configured") {
        console.log("  ⊘ SKIPPED (server reported llm_not_configured)");
      } else {
        throw new Error(`expand returned 503: ${JSON.stringify(err)}`);
      }
    } else {
      check("expand returns 200", expandRes.status === 200, `got ${expandRes.status}`);
      const body = await expandRes.json();
      check("expand returns concepts[]", Array.isArray(body.concepts));
      check("expand returns relationships[]", Array.isArray(body.relationships));
      check(
        "expand produced >=1 new concept",
        body.concepts.length >= 1,
        `got ${body.concepts.length}`
      );
      check(
        "expand concept origin is llm",
        body.concepts.every((c) => c.origin === "llm"),
        `origins: ${body.concepts.map((c) => c.origin).join(",")}`
      );
      check(
        "expand concept sourceNodeId = seed",
        body.concepts.every((c) => c.sourceNodeId === seed.id)
      );

      // Reload and verify persistence
      const after = await (await fetch(`${base}/sessions/${session.id}`)).json();
      check(
        "concepts persisted",
        after.concepts.length === beforeConcepts + body.concepts.length,
        `before=${beforeConcepts} after=${after.concepts.length} added=${body.concepts.length}`
      );
      check(
        "relationships persisted",
        after.relationships.length >= beforeRels,
        `before=${beforeRels} after=${after.relationships.length}`
      );
      check(
        "new relationships have origin=llm",
        body.relationships.every((r) => r.origin === "llm")
      );
      check(
        "no duplicate self-loops created",
        body.relationships.every((r) => r.sourceId !== r.targetId)
      );
    }
  }

  const deleteSessionRes = await fetch(`${base}/sessions/${session.id}`, { method: "DELETE" });
  check("delete session returns 204", deleteSessionRes.status === 204, `got ${deleteSessionRes.status}`);

  console.log(`\nALL CHECKS PASSED (${checksPassed}/${checksRun})`);
}

main().catch((e) => {
  console.error("\nFAILED:", e?.message || e);
  if (e?.stack) console.error(e.stack);
  process.exit(1);
});
