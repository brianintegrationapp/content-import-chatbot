import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";
import connectDB from "@/lib/mongodb";
import { DocumentModel } from "@/models/document";
import { IntegrationAppClient } from "@integration-app/sdk";

const MODEL = "gpt-4-0613";

// “tool” function the AI can call if it wants
const toolFunctions = [
  {
    name: "create_hubspot_contact",
    description: "Create a new contact in HubSpot via Integration App",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "The contact's full name",
        },
        email: {
          type: "string",
          description: "The contact's email address",
        },
      },
      required: ["name", "email"],
    },
  },
];

export async function POST(req: NextRequest) {
  try {
    const { userMessage, history } = (await req.json()) as {
      userMessage: string;
      history: { role: string; content: string }[];
    };

    // 1) Get doc content from DB
    await connectDB();
    const doc = await DocumentModel.findOne(); // or find multiple
    const docText = doc?.content || "No doc found in DB";

    // 2) We'll transform user’s chat history into OpenAI’s format
    //    Except we skip "function" roles (only keep user/assistant)
    const conversation = history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    // Then we add the latest user msg
    conversation.push({ role: "user", content: userMessage });

    // 3) Insert a "system" message at the front
    //    This system message includes doc text
    const systemMessage = {
      role: "system" as const,
      content: `You are a helpful AI with access to a function named create_hubspot_contact.
You also have access to knowledge doc content:
"""${docText}"""
If the user wants to create a hubspot contact, call create_hubspot_contact with { name, email }.
Otherwise, answer from the doc context or normal reasoning.
`,
    };

    // Final messages
    const openAIMessages = [systemMessage, ...conversation];

    // 4) Call OpenAI with function calling
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: openAIMessages,
      functions: toolFunctions,
      function_call: "auto",
    });

    // 5) Check the response
    const choice = response.choices[0];
    if (!choice) {
      return NextResponse.json({
        newMessages: [{ role: "assistant", content: "No response from AI." }],
      });
    }

    // 6) If the AI is calling our function:
    if (choice.message?.function_call) {
      const { name, arguments: argsJson } = choice.message.function_call;
      if (name === "create_hubspot_contact") {
        // Parse arguments
        let parsed;
        try {
          parsed = JSON.parse(argsJson || "{}");
        } catch (err) {
          // fallback
          parsed = {};
        }
        // Now run the tool
        const result = await createHubSpotContact(parsed.name, parsed.email);
        // Then respond with a "function" role message that has the result
        const functionMessage = {
          role: "function",
          content: result, // The output from calling the tool
        };
        return NextResponse.json({
          newMessages: [
            {
              role: "assistant",
              content: `Calling create_hubspot_contact with ${JSON.stringify(
                parsed
              )}`,
            },
            functionMessage,
          ],
        });
      }
    }

    // 7) Otherwise, it's a normal text answer
    const text = choice.message?.content || "[No text returned]";
    return NextResponse.json({
      newMessages: [{ role: "assistant", content: text }],
    });
  } catch (err: any) {
    console.error("CHAT API ERROR:", err);
    return NextResponse.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}

// This is the "tool" that actually calls Integration App
async function createHubSpotContact(name: string, email: string): Promise<string> {
  try {
    const token = process.env.INTEGRATION_APP_TEST_TOKEN || "";
    const client = new IntegrationAppClient({ token });

    // Update here to match the top-level schema that Integration App expects
    const out = await client
      .connection("hubspot")
      .action("create-contact")
      .run({
        email: email,
        fullname: name,
      });

    // Return a textual summary
    return `Success! Created contact in HubSpot with ID: ${out?.id || "(none)"}`;
  } catch (error: any) {
    return `Error creating contact: ${error.message}`;
  }
}
