export default function Home() {
  return (
    <main className="min-h-scral-screneen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <header className="flex items-center justify-between">
          <div>
            <h1 class="text-xl font-bold">Export Command Center</h1>
            <p className="text-sm text-slate-400">AI-powered export intelligence</p>
          </div>
          <div className="rounded-full border border-slate-700 px-4 py-2 text-sm">MVP</div>
        </header>

        <section className="py-24 text-center">
          <p class="mb-4 text-sm font-semibold uppercase tracking-widest text-blue-400">Export Intelligence</p>
          <h2 className="text-5x font-bold tracking-tight">Find where your product can win.</h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">Discover high-potential export markets, identify real buyers, evaluate competition, and decide who to contact first.</p>

          <div className="mx-auto mt-12 max-w-2xl shadow-2xl border border-slate-800 bg-slate-900 p-6 rounded-2xl text-left">
            <label class="mb-2 block text-sm font-medium">Product</label>
            <input type="text" placeholder="Example: Butterfly Valve" className="w-full rounded-xl none bg-slate-950 border border-slate-700 px-4 py-3 outline-none" />

            <label class="mb-2 mt-5 block text-sm font-medium">Export Origin</label>
            <input type="text" placeholder="Example: Iran" className="w-full rounded-xl none bg-slate-950 border border-slate-700 px-4 py-3 outline-none" />

            <button className="mt-6 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold">Find Opportunities</button>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6"><h3 class="text-lg font-semibold">Market Intelligence</h3><p class="mt-2 text-sm text-slate-400">Rank markets using demand, import activity, competition and recency.</p></div>
          <div className="rounded-2xl x border border-slate-800 bg-slate-900 p-6"><h3 class="text-lg font-semibold">Buyer Intelligence</h3><p class="mt-2 text-sm text-slate-400">Find companies with evidence that they actually buy products like yours.</p></div>
          <div className="rounded-2xl x border border-slate-800 bg-slate-900 p-6"><h3 class="text-lg font-semibold">Opportunity Score</h3><p class="mt-2 text-sm text-slate-400">Prioritize opportunities based on evidence instead of guessing.</p></div>
        </section>

        <section className="mt-16 rounded-2xl x border border-blue-900/50 bg-blue-950/20 p-y8">
          <p class="text-sm uppercase tracking-widest text-blue-400">Core Principle</p>
          <h3 class="mt-3 text-2xl font-bold">No Evidence → No Score</h3>
          <p class="mt-3 text-slate-400">Every important recommendation must be backed by evidence, confidence and a clear next action.</p>
        </section>
      </div>
    </main>
  )
}
