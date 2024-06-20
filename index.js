const restify = require("restify");

const {
  BotFrameworkAdapter,
  ConfigurationServiceClientCredentialFactory,
  ConfigurationBotFrameworkAuthentication,
  CloudAdapter,
  ActivityTypes,
  MessageFactory,
} = require("botbuilder");
const WebSocket = require("ws");
const axios = require("axios");
require("dotenv").config();

// For server
// const credConfig = require("./config");
// let config = {
//   MicrosoftAppId: credConfig.MicrosoftAppId,
//   MicrosoftAppPassword: credConfig.MicrosoftAppPassword,
//   MicrosoftAppType: "MultiTenant",
// };
// For server end

// for llocal
let config = {
  MicrosoftAppId: process.env.MicrosoftAppId,
  MicrosoftAppPassword: process.env.MicrosoftAppPassword,
  MicrosoftAppType: "MultiTenant",
};
// for llocal end

console.log("config==> ", config);

const credentialsFactory = new ConfigurationServiceClientCredentialFactory(
  config
);

// const botFrameworkAuthentication = new ConfigurationBotFrameworkAuthentication(
//   {},
//   credentialsFactory
// );

// const adapter = new CloudAdapter(botFrameworkAuthentication);

const adapter = new BotFrameworkAdapter({
  appId: config.MicrosoftAppId,
  appPassword: config.MicrosoftAppPassword,
});
const server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
  console.log(`\n${server.name} listening to ${server.url}`);
});

server.get("/", async (req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.writeHead(200);
  res.write(
    `<html><body><h1>Copilot teams bot backend working</h1></body></html>`
  );
  res.end();
});

// server.post("/copilot-messaging", async (req, res) => {
//   try {
//     await adapter.processActivity(req, res, async (context) => {
//       if (context.activity.type === "message") {
//         await context.sendActivity(`You said '${context.activity.text}'`);
//       }
//       console.log("context", context);
//     });
//   } catch (error) {
//     console.error("Error processing activity:", error);
//     res?.status(500).send(error);
//   }
// });

function constructWebSocketURL(streamUrl) {
  const ws = new WebSocket(streamUrl);

  // WebSocket event listeners
  ws.on("open", () => {
    console.log("WebSocket connection established");
  });

  ws.on("message", async (event) => {
    // console.log("Received message:", JSON.stringify(event));
    // console.log("Received message:",JSON.stringify(JSON.parse(event)))

    // Example: Parse and process message data
    try {
      const eventData = JSON.parse(event);
      if (eventData?.activities[0].type === "message") {
        // Process incoming message
        console.log(
          "Incoming message:",
          JSON.stringify(eventData?.activities[0].text)
        );

        const incomingText = JSON.stringify(eventData?.activities[0].text); // Extract the text
        await adapter?.processActivity((context) => {
          context?.sendActivity(MessageFactory.text(incomingText));
        });
      }
    } catch (error) {
      console.error("Error parsing incoming message:", error);
    }
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });

  ws.on("close", () => {
    console.log("WebSocket connection closed");
  });
}

async function startConversation() {
  try {
    // Replace with your Direct Line secret or token
    const directLineSecret = await getToken();

    // Request configuration
    const config = {
      headers: {
        Authorization: `Bearer ${directLineSecret}`,
      },
    };

    // Initiate conversation request
    const response = await axios.post(
      "https://directline.botframework.com/v3/directline/conversations",
      null,
      config
    );

    // Extract streamUrl from the response data
    const { conversationId, token, streamUrl } = response.data;

    console.log("Conversation ID:", conversationId);
    console.log("Token:", token);
    console.log("WebSocket Stream URL:", streamUrl);
    constructWebSocketURL(streamUrl);
    const conversationDetails = {
      conversationId: conversationId,
      token: token,
    };
    sendInitialMessage(conversationDetails);

    // Now you can use `streamUrl` to establish a WebSocket connection
    // Example: Implement WebSocket connection here
    // connectWebSocket(streamUrl);
  } catch (error) {
    console.error("Error starting conversation:", error.message);
  }
}

async function handleTeamsMessage(context) {
  if (context.activity.type === ActivityTypes.Message) {
    const messageText = context.activity.text;
    console.log("Received message from Teams:", messageText);

    // Extract context from the message (replace with your logic)
    const contextData = extractContext(messageText);

    // Send context to Copilot (API call)
    // await sendToCopilotApi(contextData);
    await sendInitialMessage(contextData);

    // Listen for Copilot messages through WebSocket
    // listenForCopilotMessages();
  }
}

server.post("/copilot-messaging", async (req, res) => {
  try {
    await adapter.processActivity(req, res, handleTeamsMessage);
  } catch (error) {
    console.error("Error processing activity:", error);
    res?.status(500).send(error);
  }
});

// Function to extract context from Teams message (replace with your logic)
function extractContext(messageText) {
  return { messageText }; // Placeholder for extracted context
}

async function sendInitialMessage(conversationDetails, contextData) {
  try {
    const { conversationId, token } = conversationDetails;

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const body = JSON.stringify({
      name: "startConversation",
      locale: "en-EN", // Example: Change as per your requirement
      type: "event",
      from: {
        id: "5839aa31-0a18-4ae6-bf9a-074b29de79b3",
        role: "user",
      },
      teamsmsg:contextData
    });

    const url = `https://directline.botframework.com/v3/directline/conversations/${conversationId}/activities`;

    const response = await axios.post(url, body, { headers });

    console.log("Initial message sent:", response.data);
    return response.data; // Optional: Return data if needed
  } catch (error) {
    console.error("Error sending initial message:", error.message);
    throw error; // Propagate error up the call stack
  }
}

async function getToken() {
  try {
    const Tokenurl = "https://connector.lab.bravishma.com/copilot-token";

    let token = await axios.get(Tokenurl);

    return token.data.copilotToken;
  } catch (error) {
    throw new Error("Error fetching cobro token");
  }

  // axios
  //   .get(Tokenurl)
  //   .then((response) => {
  //     token = response.data.copilotToken;
  //   })
  //   .catch((err) => console.log("Error fetching cobro token==> ", err));
}

startConversation();
