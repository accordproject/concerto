# Google Summer of Code 2026
# Organization: Accord Project (Linux Foundation)
# Ideas Targeted: #1 Agentic Workflow + #7 LLM Template Logic Executor
# Contributor: Mohamed Habib Khattat

---

## PERSONAL INFORMATION

| Field | Value |
|---|---|
| **Name** | Mohamed Habib Khattat |
| **Email** | mohamedhabib.khattat@gmail.com |
| **GitHub (primary)** | github.com/MuhamedHabib (+5,000 commits · 800+ followers) |
| **GitHub (secondary)** | github.com/MohamedKhattat (59 repos · 1,100+ stars · Pull Shark ×3) |
| **LinkedIn** | linkedin.com/in/mohamed-habib-khattat-2b206a173 |
| **Discord** | Habib (joined Accord Project server) |
| **Location** | Tunis, Tunisia (UTC+1) |
| **Availability** | Full-time commitment |
| **Project Size** | 90hrs (Idea 1) + 90hrs (Idea 7) = combined proposal |

---

## PROJECT TITLE

**Ontology-Grounded Agentic Workflow with LLM Template Logic Executor
for Accord Project Smart Legal Contracts**

*Combining Idea #1 (Agentic Workflow) and Idea #7 (LLM Logic Executor)
with a unique semantic grounding layer — proven in production at 3,000+ banks*

---

## ABSTRACT

The Accord Project enables smart legal contracts through three components:
**Concerto** (data modeling), **TemplateMark** (contract text),
and **TypeScript/Ergo** (contract logic).

This proposal targets two complementary GSoC 2026 ideas:

**Idea #1 — Agentic Workflow for Drafting Templates:**
We will implement a CLI-based agentic orchestrator using specialist agents
that take template requirements in natural language and produce valid
Accord Project templates — including Concerto model, TemplateMark text,
and logic — with tool calling for concerto and template-engine validation.

**Idea #7 — LLM Based Template Logic Executor:**
We will implement a generic TypeScript/JS executor that delegates
contract logic to an LLM reasoning engine, integrated into
`TemplateArchiveProcessor`'s `trigger` and `init` functionality,
without requiring an explicit TypeScript logic file.

**Our unique contribution:** Both ideas are implemented with an
OWL semantic grounding layer — ontology files extracted from
legal domain knowledge — that prevents LLM hallucination in legal contexts.
This architecture is not theoretical: we have deployed it in production
systems serving 3,000+ banks via Temenos Exchange.

---

## PRIOR ENGAGEMENT WITH THE CODEBASE

Before writing this proposal, we forked, cloned, built,
and tested all three Accord Project repositories locally.

### What we executed:

**template-engine:**
```bash
npm install   # ✅ 732 packages installed
npm run build # ✅ dist/ generated via rollup (52ms)
npm test      # ⚠️ Node v24 incompatibility with Jest
              # Root cause identified: requires Node v20 LTS
              # 4 ESLint unused directives found → PR ready
```

**concerto:**
```bash
# Forked and cloned locally
# Added HTML pages for browser availability
# Tested browser compatibility of Concerto runtime
# Pushed fixes to our fork
# github.com/MuhamedHabib/concerto
```

**template-archive (cicero):**
```bash
# Forked and cloned locally
# Studied template structure: .cto + .tem.md + logic/
# Ran latedeliveryandpenalty template end-to-end
# github.com/MuhamedHabib/template-archive
```

### Files we studied in depth:

```
template-engine/src/
├── JavaScriptEvaluator.ts        → current logic execution kernel
├── TemplateArchiveProcessor.ts   → trigger/init entry points
├── TemplateMarkInterpreter.ts    → TemplateMark AST (34KB)
└── TemplateMarkToJavaScriptCompiler.ts → compilation pipeline
```

### Our forked repositories:

```
github.com/MuhamedHabib/template-engine-GSoC
github.com/MuhamedHabib/concerto
github.com/MuhamedHabib/template-archive
```

### First PR — ready to submit today:

```
Fix: remove 4 unused eslint-disable directives
Files:
→ src/runtime/declarations.ts:16
→ test/archives/.../io.clause.latedeliveryandpenalty@0.1.0.ts:1
→ test/archives/.../org.accordproject.contract@0.2.0.ts:1
→ test/archives/.../org.accordproject.time@0.3.0.ts:1
```

---

## UNDERSTANDING THE CURRENT ARCHITECTURE

The template-engine converts a TemplateMark DOM to an AgreementMark DOM,
evaluating TypeScript expressions for conditional sections and formulae,
replacing variable references with values from the contract data.

**Current pipeline (as we studied locally):**

```
User Request (JSON)
      │
      ▼
TemplateArchiveProcessor.trigger()  ← Idea #7 entry point
→ loads .cta archive
→ validates request against Concerto model
→ calls JavaScriptEvaluator (sandboxed VM)
→ returns response + state + emitted events
      │
      ▼
AgreementMark DOM
      │
      ▼
HTML · PDF · DOCX
```

**What is missing (what we will build):**

```
Idea #1: No agentic workflow to CREATE templates from NL
Idea #7: No LLM-based alternative when no TypeScript logic file exists
```

---

## IDEA #7 — LLM BASED TEMPLATE LOGIC EXECUTOR

*90hrs / 8 weeks — Mentors: Dan Selman, Diana Lease*

### What the official idea requires:

> A generic executor in TypeScript/JS delegating to a reasoning LLM.
> Input: request/transaction (Concerto JSON) + contract state + contract text.
> Output: state changes + response JSON + emitted events.
> Integrated into trigger and init in TemplateArchiveProcessor.
> Configuration parameters for LLM API and keys.

### Our implementation plan:

#### File: `src/LLMExecutor.ts` (new)

```typescript
/**
 * LLMExecutor — Generic LLM-based template logic executor.
 * Integrates into TemplateArchiveProcessor as alternative kernel.
 * Used when no explicit TypeScript logic file exists in template.
 */
export interface LLMExecutorConfig {
  provider: 'openai' | 'anthropic' | 'ollama' | 'custom';
  model: string;           // e.g. 'gpt-4o', 'claude-3-5-sonnet'
  apiKey?: string;         // from env or config
  baseUrl?: string;        // for custom/local LLMs
  maxTokens: number;
  temperature: number;     // low for legal reasoning (0.1-0.2)
  semanticGrounding: boolean; // enable OWL grounding (our addition)
  ontologyPath?: string;   // .owl file for grounding (optional)
}

export interface LLMExecutorInput {
  contractText: string;    // TemplateMark text of the contract
  contractState: object;   // current contract state (Concerto JSON)
  request: object;         // incoming request (Concerto JSON)
  requestType: string;     // Concerto type name of the request
}

export interface LLMExecutorOutput {
  response: object;        // Concerto JSON response
  state: object;           // updated contract state
  emit: object[];          // emitted events (Concerto JSON array)
}

export class LLMExecutor {
  constructor(private config: LLMExecutorConfig) {}

  /**
   * Execute contract logic using LLM reasoning.
   * Called by TemplateArchiveProcessor.trigger() when
   * no TypeScript logic file is present in template archive.
   */
  async execute(input: LLMExecutorInput): Promise<LLMExecutorOutput> {
    const prompt = this.buildPrompt(input);
    const rawResponse = await this.callLLM(prompt);
    const parsed = this.parseResponse(rawResponse);
    await this.validateOutput(parsed, input);
    return parsed;
  }

  private buildPrompt(input: LLMExecutorInput): string {
    return `You are a smart legal contract logic executor.
Contract text: ${input.contractText}
Current state: ${JSON.stringify(input.contractState)}
Incoming request (${input.requestType}): ${JSON.stringify(input.request)}

Execute the contract logic and return ONLY valid JSON:
{
  "response": { ... },  // response object matching Concerto type
  "state": { ... },     // updated contract state
  "emit": [ ... ]       // array of emitted events
}`;
  }

  private async callLLM(prompt: string): Promise<string> {
    // Pluggable LLM provider — OpenAI, Anthropic, Ollama, custom
  }

  private async validateOutput(
    output: LLMExecutorOutput,
    input: LLMExecutorInput
  ): Promise<void> {
    // Validate output against Concerto model
    // Optional: validate against OWL ontology (semantic grounding)
  }
}
```

#### Modification: `src/TemplateArchiveProcessor.ts`

```typescript
// ADD: detect if template has logic file
private hasLogicFile(archive: TemplateArchive): boolean {
  return archive.hasFile('logic/logic.js') ||
         archive.hasFile('logic/logic.ts');
}

// MODIFY: trigger() method
async trigger(request: object, state: object): Promise<TriggerResult> {
  if (this.hasLogicFile(this.archive)) {
    // Existing path: JavaScript/TypeScript executor
    return this.javaScriptEvaluator.evaluate(request, state);
  } else if (this.config.llmExecutor) {
    // New path: LLM executor (Idea #7)
    return this.llmExecutor.execute({
      contractText: this.getContractText(),
      contractState: state,
      request,
      requestType: this.getRequestType()
    });
  }
  throw new Error('No logic executor available for this template');
}
```

#### Configuration (package.json of template):

```json
{
  "name": "@accordproject/payment-llm",
  "version": "0.1.0",
  "accordproject": {
    "template": "clause",
    "logic": "llm",
    "llm": {
      "provider": "openai",
      "model": "gpt-4o",
      "temperature": 0.1,
      "semanticGrounding": true
    }
  }
}
```

---

## IDEA #1 — AGENTIC WORKFLOW FOR DRAFTING TEMPLATES

*90hrs / 8 weeks — Mentors: Sanket Shevkar, Niall Roche*

### What the official idea requires:

> Agentic workflow orchestrator (CrewAI or similar).
> Specialist agent personas + tasks.
> Tool calling for concerto and template-engine validation.
> Choice of AI models.
> CLI interface similar to gemini-cli / claude code.

### Our implementation plan:

#### CLI Interface (entry point):

```bash
# Usage — similar to gemini-cli
accord-agent "Draft a late delivery penalty clause:
              - 2% penalty per week of delay
              - Maximum cap of 10%
              - Force majeure exception applies"

# Output:
✓ Analyzing requirements...
✓ Generating Concerto model...    [validated ✓]
✓ Drafting template text...       [validated ✓]
✓ Generating contract logic...    [validated ✓]
✓ Running semantic checks...      [validated ✓]

Template created: ./latedelivery-generated/
├── package.json
├── model/model.cto               ✓ valid Concerto
├── text/grammar.tem.md           ✓ valid TemplateMark
└── logic/logic.ts                ✓ valid TypeScript logic
```

#### Agent Architecture:

```typescript
// src/agents/AgentOrchestrator.ts

/**
 * Orchestrates specialist agents to draft Accord Project templates.
 * Compatible with CrewAI (Python) and LangGraph (TypeScript).
 * Agents defined as reusable personas — orchestrator-agnostic.
 */
export class AgentOrchestrator {

  // Agent 1: Legal Analyst
  // Role: Understands legal domain requirements
  // Task: Extract clauses, parties, obligations, conditions
  readonly legalAnalystAgent: AgentPersona = {
    role: 'Legal Domain Analyst',
    goal: 'Extract structured legal requirements from natural language',
    backstory: 'Expert in contract law and legal clause structure',
    tools: ['requirementsParser', 'legalKnowledgeBase']
  };

  // Agent 2: Concerto Modeler
  // Role: Creates data model from legal concepts
  // Task: Generate valid .cto file + validate via concerto-core
  readonly concertoAgent: AgentPersona = {
    role: 'Concerto Data Modeler',
    goal: 'Generate valid Concerto data model from legal concepts',
    backstory: 'Expert in Accord Project Concerto modeling language',
    tools: ['concertoValidator', 'concertoGenerator']
  };

  // Agent 3: Template Author
  // Role: Writes contract text with TemplateMark variables
  // Task: Generate .tem.md file aligned with Concerto model
  readonly templateAuthorAgent: AgentPersona = {
    role: 'Template Author',
    goal: 'Generate valid TemplateMark contract text',
    backstory: 'Expert in legal drafting and TemplateMark syntax',
    tools: ['templateValidator', 'markdownParser']
  };

  // Agent 4: Logic Engineer
  // Role: Implements contract logic
  // Task: Generate TypeScript logic OR configure LLM executor
  readonly logicEngineerAgent: AgentPersona = {
    role: 'Contract Logic Engineer',
    goal: 'Implement executable contract logic',
    backstory: 'Expert in TypeScript and contract execution semantics',
    tools: ['logicValidator', 'templateEngine']
  };

  // Agent 5: Quality Validator
  // Role: Final validation gate
  // Task: Run full template through template-engine, report errors
  readonly validatorAgent: AgentPersona = {
    role: 'Template Quality Validator',
    goal: 'Ensure generated template is valid and executable',
    backstory: 'Expert in Accord Project testing and validation',
    tools: ['templateEngine', 'concertoValidator', 'semanticChecker']
  };
}
```

#### Tool Calling — official requirement:

```typescript
// src/agents/tools/AccordProjectTools.ts

/**
 * Tool: Validate Concerto model
 * Called by: concertoAgent, validatorAgent
 */
export const concertoValidatorTool = {
  name: 'concertoValidator',
  description: 'Validates a Concerto model file (.cto)',
  execute: async (ctoContent: string): Promise<ValidationResult> => {
    const modelManager = new ModelManager();
    modelManager.addCTOModel(ctoContent);
    return { valid: true, model: modelManager.getModels() };
  }
};

/**
 * Tool: Validate template via template-engine
 * Called by: templateAuthorAgent, validatorAgent
 */
export const templateEngineTool = {
  name: 'templateEngine',
  description: 'Validates template text and runs trigger against sample data',
  execute: async (
    templateText: string,
    model: object,
    sampleData: object
  ): Promise<EngineResult> => {
    const processor = new TemplateArchiveProcessor();
    return processor.trigger(sampleData, {});
  }
};

/**
 * Tool: Semantic checker (our OWL addition — optional)
 * Called by: validatorAgent
 * Checks semantic consistency using OWL ontology
 */
export const semanticCheckerTool = {
  name: 'semanticChecker',
  description: 'Optional: validates template semantics via OWL ontology',
  execute: async (template: object): Promise<SemanticResult> => {
    // Only activated if ontologyPath configured
    // Uses OWL reasoner for formal validation
  }
};
```

---

## OUR UNIQUE VALUE — SEMANTIC GROUNDING

Both ideas benefit from our production-proven OWL layer:

```
WITHOUT semantic grounding:
LLM generates contract logic → possible hallucination
→ "penalty = 150%" ← legally invalid, no catch

WITH semantic grounding (our addition):
LLM generates → OWL validates → SWRL inference
→ "penalty = 150%" ← caught: violates owl:maxInclusive 100
→ agent corrects → valid contract generated
```

This is not a new idea for us.
We deployed this exact pattern in production:

```
UniQ ODS (Temenos Exchange · 3,000+ banks):
→ OWL ontologies from ISO 31000 + PMBOK in production
→ SWRL rules on live banking data: ✅ RUNNING
→ LLM agents grounded in ontology: ✅ RUNNING
→ RDF4J Java + owlready2 Python loaders: ✅ RUNNING
```

---

## WEEK-BY-WEEK TIMELINE

### Weeks 1–2 — Community Bonding + Deep Dive

```
→ Submit PR: fix 4 ESLint warnings (already identified)
→ Study JavaScriptEvaluator.ts execution model in depth
→ Study TemplateArchiveProcessor trigger/init flow
→ Study existing template examples (latedeliveryandpenalty)
→ Design LLMExecutor interface → share with Dan Selman
→ Design AgentOrchestrator personas → share with Sanket Shevkar
→ Set up complete dev environment (Node v20, all 3 repos)

Milestone: 1 merged PR + approved design documents
```

### Weeks 3–4 — LLMExecutor Core (Idea #7)

```
→ Implement LLMExecutor.ts
→ OpenAI provider integration (primary)
→ Anthropic provider integration (secondary)
→ Ollama support for local/offline models
→ buildPrompt() using contract text + state + request
→ parseResponse() with strict JSON validation
→ Modify TemplateArchiveProcessor.trigger():
  add hasLogicFile() check → route to LLMExecutor
→ Configuration via package.json (provider, model, apiKey)
→ Unit tests for all providers
→ Integration test: template without logic → LLM executes

Milestone: LLMExecutor working + integrated + tested
```

### Weeks 5–6 — AgentOrchestrator + Tool Calling (Idea #1)

```
→ Implement 5 specialist agent personas
→ Implement tool calling: concertoValidator + templateEngine
→ Agent workflow: NL input → model → text → logic → validate
→ CrewAI integration (Python) for orchestration
→ LangGraph integration (TypeScript) as alternative
→ Integration tests: NL → valid .cta template

Milestone: agent workflow producing valid templates
```

### Weeks 7–8 — CLI Interface + Semantic Grounding

```
→ Implement CLI: accord-agent "requirements..."
  similar to gemini-cli / claude code
→ Spinner + progress feedback per agent step
→ Output: ready-to-use template directory
→ AI model selection: --model gpt-4o / claude-3-5 / ollama
→ Semantic grounding layer (OWL optional):
  --semantic-check flag enables OWL validation
→ End-to-end test: NL input → template → trigger → response
→ Documentation + examples
→ Blog post draft for accordproject.org

Milestone: complete working CLI + documentation
```

---

## DELIVERABLES

| # | Deliverable | Idea | Files |
|---|-------------|------|-------|
| D1 | ESLint PR | Both | 4 files fixed |
| D2 | LLMExecutor.ts | #7 | New file in template-engine |
| D3 | TemplateArchiveProcessor update | #7 | Modified existing |
| D4 | Multi-provider LLM support | #7 | OpenAI · Anthropic · Ollama |
| D5 | AgentOrchestrator.ts | #1 | New file in template-engine |
| D6 | 5 specialist agent personas | #1 | Reusable + orchestrator-agnostic |
| D7 | AccordProjectTools.ts | #1 | concerto + template-engine tools |
| D8 | CLI interface (accord-agent) | #1 | gemini-cli style |
| D9 | Semantic grounding layer | Both | Optional OWL validation |
| D10 | Full test suite | Both | 90%+ coverage |
| D11 | Documentation + blog | Both | Published |

---

## WHY WE ARE THE RIGHT CONTRIBUTORS

### We have deployed this in production — not a theory

**Evidence 1 — Temenos Exchange (3,000+ banks)**

We built UniQ ODS — a banking data platform published on Temenos Exchange.

Production stack (identical to what we propose):
```
→ LLM agents grounded in OWL ontology    ✅ PRODUCTION
→ SWRL rules on live data               ✅ PRODUCTION
→ Multi-provider LLM integration        ✅ PRODUCTION
→ TypeScript + Python agentic workflows ✅ PRODUCTION
```

**Evidence 2 — Easy Contract (Smart Legal Contracts)**

We built a complete smart contract automation platform:
```
→ Contract generation from requirements  ✅ BUILT
→ Semantic validation before execution   ✅ BUILT
→ Digital signatures (XAdES/PKCS#11)    ✅ BUILT
→ Selected for Risk Management workshop  ✅ RECOGNIZED
```
Direct functional equivalent of Accord Project's mission.

**Evidence 3 — IBM Hyperledger Fabric**
```
→ IBM Blockchain Foundation Developer   ✅ CERTIFIED
→ IBM Blockchain Essentials             ✅ CERTIFIED
→ Smart contracts on Fabric             ✅ BUILT
```

**Evidence 4 — ITAS Government System**
```
→ AI agents for tax declaration lifecycle ✅ MENTORED
→ LLM + OWL semantic agents              ✅ DEPLOYED
→ Government-scale production            ✅ PROVEN
```

### We already know the codebase

```
✅ All 3 repos forked + cloned + built locally
✅ template-engine: npm install + npm run build passing
✅ 4 ESLint warnings identified → PR ready to submit today
✅ JavaScriptEvaluator.ts studied (our LLMExecutor mirrors it)
✅ TemplateArchiveProcessor.ts understood (our entry point)
✅ Concerto: HTML pages added + pushed to fork
✅ Discord: joined + introduction sent + mentors reviewed
✅ Node v24 incompatibility identified + documented
```

### GitHub — sustained 6-year commitment

```
github.com/MuhamedHabib:  +5,000 commits · 800+ followers
github.com/MohamedKhattat: 59 repos · 1,100+ stars
                            Pull Shark ×3 ✅
                            Pair Extraordinaire ×3 ✅
```

---

## ACADEMIC AND PROFESSIONAL BACKGROUND

```
Engineering Degree in Data Science — ESPRIT (2023)
Bachelor in Computer Science — ISTIC (2020)

Certifications:
→ IBM Blockchain Foundation Developer ✅
→ IBM Blockchain Essentials ✅

Production systems:
→ UniQ ODS · Temenos Exchange · 3,000+ banks worldwide
→ PMIS Madagascar · World Bank · Ministry of Energy
→ POS NACEF/CIMF · +5,000 fiscal stations nationally
→ Easy Contract · Insurance smart legal contracts
→ Warba Bank Kuwait · offshore Market/Liquidity/Cost Risk

Languages: French (fluent) · English (fluent) · Arabic (fluent)
```

---

## COLLABORATION COMMITMENT

```
→ Weekly sync with mentors (Sanket Shevkar · Niall Roche · Dan Selman)
→ Daily Discord updates during active development
→ Design documents shared BEFORE coding for early feedback
→ TDD: tests written before implementation
→ Small reviewable PRs — < 300 lines each
→ Review comments addressed within 24 hours
→ Public weekly progress on Accord Project Discord
```

We see this GSoC project as the beginning of a long-term
relationship with the Accord Project community and ecosystem.

---

*Google Summer of Code 2026*
*Organization: Accord Project — Linux Foundation*
*Proposal deadline: March 31, 2026 — 18:00 UTC*
*Contributor: Mohamed Habib Khattat*
*github.com/MuhamedHabib · mohamedhabib.khattat@gmail.com*
