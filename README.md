In this example, we’ll walk you through how to create an AI chatbot that can actually perform real actions— such as creating new leads in your CRM— by leveraging the power of **Integration App**. We’ll look under the hood at an example codebase built around OpenAI GPT and HubSpot, though you can adapt it to other LLMs and other integrations.  

We’ll explore the key parts of the application, highlight where Integration App fits in, and show how you can extend this pattern to build agentic AI experiences for your own systems.

---

## What is Integration App (and Why Use It)?

[Integration App](https://integration.app) is a platform that securely connects your SaaS tools—HubSpot, Salesforce, Google Drive, and hundreds more—so you can automate tasks and access data in a unified way. In an AI context, this means you can let your large language models (LLMs) call real-world actions:  

- **Creating CRM contacts** (HubSpot, Salesforce)  
- **Sending messages** (Slack, Teams)  
- **Managing files** (Dropbox, Google Drive, Box)  
- **Updating spreadsheets** (Google Sheets, Excel)  
- …and more  

**Why Integration App for agent-based AI?**  

1. **Unified, no-code integration**: Instead of manually coding each step, you simply pick which Integration App actions your AI can call (like “create-contact” for HubSpot).  
2. **Security & Permissions**: Integration App helps ensure your AI only accesses data and actions you’ve explicitly allowed.  
3. **Simplified token management**: Rather than embedding separate tokens for every service, the AI just needs one Integration App token.  
4. **Easily extendable**: You can add or remove integrations, change authentication credentials, and specify what data is or isn’t available to the AI—without recoding everything from scratch.

---

## The Example: An AI Chatbot That Can Create HubSpot Contacts

The sample code (shown in the snippet below) demonstrates a Next.js-based application where a user can chat with an AI. In the conversation, the user might say, “Create a new contact named Jane with email jane@example.com,” and the AI will:

1. Decide it should call a “create_hubspot_contact” function  
2. Pass the arguments “Jane” and “jane@example.com”  
3. The function is implemented via Integration App—so behind the scenes, it calls the HubSpot “create-contact” action.  

We’ll break down how it works:

### 1. A Chat Endpoint That Uses OpenAI GPT

In `chat/api/route.ts`, we define a POST endpoint that receives user chat input. We call OpenAI’s GPT to process the conversation. Crucially, we also **define a tool function** named `create_hubspot_contact` in GPT’s “function calling” format:

```ts
// “tool” function the AI can call if it wants
const toolFunctions = [
  {
    name: "create_hubspot_contact",
    description: "Create a new contact in HubSpot via Integration App",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "The contact's full name" },
        email: { type: "string", description: "The contact's email address" },
      },
      required: ["name", "email"],
    },
  },
];
```

OpenAI GPT can decide to call this function if user instructions look like they require creating a HubSpot contact. This is a new feature of OpenAI’s Chat Completions that enables “function calling.”  

### 2. Function Call Implementation Via Integration App

The function is implemented in the same file:

```ts
// This is the "tool" that actually calls Integration App
async function createHubSpotContact(name: string, email: string): Promise<string> {
  try {
    const token = process.env.INTEGRATION_APP_TEST_TOKEN || "";
    const client = new IntegrationAppClient({ token });

    const out = await client
      .connection("hubspot")       // use the "hubspot" connection
      .action("create-contact")    // call the built-in "create-contact" action
      .run({ email, fullname: name });

    return `Success! Created contact in HubSpot with ID: ${out?.id || "(none)"}`;
  } catch (error: any) {
    return `Error creating contact: ${error.message}`;
  }
}
```

Thanks to Integration App’s SDK:
- We establish a client with `new IntegrationAppClient({ token })`  
- We specify which connection (HubSpot)  
- We call a standard or custom action (in this case, “create-contact”)  
- We pass arguments as JSON  
- We receive structured output from HubSpot  

Because we keep everything in Integration App, we don’t have to write special HubSpot auth logic or learn the HubSpot API. We just pick the action from Integration App’s library.

---

## Enabling Doc Context with Integration App

Besides letting the AI create contacts, the example also fetches and stores relevant knowledge documents. For instance, you might sync PDF files or knowledge base articles from an external system so the AI can answer questions about them. Or, more relevently- you could import a list of jumbled contact information in a plain text document, and the agent could create new HubSpot contacts from it.

### Syncing Documents

In `integrations/page.tsx` and the associated `DocumentPicker`, we show how the user can connect their HubSpot account (or other accounts) and choose which documents or folders to sync. Integration App monitors those documents for changes and stores them in a database that the AI can reference.

### Referencing Doc Content

In `chat/api/route.ts`, we see an example snippet:
```ts
const doc = await DocumentModel.findOne();
const docText = doc?.content || "No doc found in DB";

// The system message includes doc text
const systemMessage = {
  role: "system",
  content: `You are a helpful AI...
You also have access to knowledge doc content:
"""${docText}"""
If the user wants to create a hubspot contact, ...`,
};
```
With this, GPT can incorporate your synced doc data when responding to the user. Instead of relying purely on GPT’s training data, it has fresh, real-time information about your business or product stored in docText.

---

## How to Set It Up

### 1. Configure Your Integration App Workspace
- Log in to your Integration App account  
- Create a connection for HubSpot (or any other system you want)  
- Check that you have the appropriate “actions” (like “create-contact”)  

### 2. Provide the Integration App Token
- In your environment variables (e.g., `.env`), set `INTEGRATION_APP_TEST_TOKEN` to your workspace’s token.  

### 3. Run the Next.js App
- Clone or adapt the code from this example  
- `npm install` or `yarn install`  
- `npm run dev`  
- Open http://localhost:3000/chat  

### 4. Chat and Create Contacts
Ask questions or say “Create a contact named John with email john@example.com.” You’ll see your logs or console show that the AI called the `create_hubspot_contact` function, which in turn calls Integration App.

---

## Going Further: Multiple Integrations, Agentic Behaviors, and More

This project is a minimal example, but it points to bigger possibilities:
- **Multiple Integrations:** Instead of just “hubspot,” you could have multiple connections (Salesforce, Stripe, Trello, etc.).  
- **Additional Tools / Actions:** Let the AI call a “send-email” action, a “create-record” action in a database, or a “generate-invoice” action.  
- **User Permission or Review:** Let the user confirm or reject AI’s attempt to call a tool.  
- **Advanced Agent Workflow:** Combine doc references with real actions so the AI can fetch current data, reason about it, then automatically update your CRM.  

---

## What role does Integration App play here?

1. **Central Hub:** Manage all your third-party app connections in one place.  
2. **Secure:** Integration App enforces OAuth flows, encryption, and user permissions.  
3. **Scalable:** Add or remove data sources on the fly, with minimal code changes.  
4. **Future-Proof:** Use the same approach with different LLMs (OpenAI, Anthropic, etc.) or alternative AI clients.  

With Integration App, your AI agent can truly become “agentic”—capable of reading your organization’s data in near real time and executing tasks seamlessly, all while you keep full control and visibility into what it’s doing.

---

## Key Takeaways

- **Function Calling** in OpenAI or other LLMs lets you create a chat-based agent that calls code.  
- **Integration App** provides a broad set of prebuilt actions to orchestrate tasks in various SaaS apps.  
- **Document Sync** ensures the AI has relevant, up-to-date knowledge.  
- Combining all these yields a powerful chatbot that isn’t just talk—it can do real work on your behalf!

---

**Ready to build your own AI agent with Integration App?**  
- Explore the [Integration App Docs](https://integration.app/docs)  
- Try hooking up new services or actions  
- Start coding your own chatbot using the example patterns above  

**Have questions or want help?** [Get in touch](https://integration.app/contact) with our team! We’re excited to see what you’ll create.
