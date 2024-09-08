import express from "express";
import { auth, resolver, protocol } from "@iden3/js-iden3-auth";
import open, { openApp, apps } from "open";
import getRawBody from "raw-body";
import path from "path";

const app = express();
const port = 5000;

//app.use(express.static("../static"));

app.get("/", (req, res) => {
  res.send("Server is ready");
});

app.get("/api/sign-in", (req, res) => {
  console.log("get Auth Request");
  getAuthRequest(req, res);
});

try {
  app.post("/api/callback", (req, res) => {
    console.log("callback");
    callback(req, res);
  });
} catch (error) {
  console.error(error);
  console.log(error);
}

app.listen(port, () => {
  console.log("server running on port 5000");
});

// Create a map to store the auth requests and their session IDs
const requestMap = new Map();

// GetQR returns auth request
async function getAuthRequest(req, res) {
  // Audience is verifier id
  const hostUrl =
    "http://localhost:5000";
  const sessionId = 1;
  const callbackURL = "/api/callback";
  const audience =
    //"did:polygonid:polygon:amoy:2qb8zJTJCC2ZxaXx6Uj92ptybzjhapF1tHzZMBmY1w";
    //"did:iden3:privado:main:2SZaLjZxjQdSNRT9x2VY3Mhpov4RDJRu9otN7Z2v9c";
    //"did:polygonid:polygon:amoy:2qUkeEY3eeDELgCdgnRvTzFU1DURomnAXbzwxKCfBx";
    "did:polygonid:polygon:amoy:2qQ68JkRcf3xrHPQPWZei3YeVzHPP58wYNxx2mEouR";

  const uri = `${hostUrl}${callbackURL}?sessionId=${sessionId}`;

  // Generate request for basic authentication
  const request = auth.createAuthorizationRequest("test flow", audience, uri);

  request.id = "7f38a193-0918-4a48-9fac-36adfdb8b542";
  request.thid = "7f38a193-0918-4a48-9fac-36adfdb8b542";
  console.log(request);

  /*
  const proofRequest = {
    circuitId: "credentialAtomicQuerySigV2",
    id: 1720718787,
    query: {
      allowedIssuers: ["*"],
      context: "ipfs://QmeakkYXqgVAG2evbZz8SECSxJ14J9uuNHc4t9cGwwXkS1",
      type: "TestAgeChecker",
      credentialSubject: {
        age: {
          $gt: 17,
        },
      },
    },
  };
*/

  // Define the verification request
  const verificationRequest = {
    backUrl: hostUrl,
    finishUrl: hostUrl,
    logoUrl: hostUrl,
    name: "Everi",
    zkQueries: [
      {
        circuitId: "credentialAtomicQuerySigV2",
        id: 1724187394,
        query: {
          allowedIssuers: [
            "*",
            //"did:iden3:privado:main:2ScrbEuw9jLXMapW3DELXBbDco5EURzJZRN1tYj7L7",
          ],
          context:
            "https://raw.githubusercontent.com/anima-protocol/claims-polygonid/main/schemas/json-ld/pol-v1.json-ld",
          type: "AnimaProofOfLife",
          credentialSubject: {
            human: {
              $eq: true,
            },
          },
        },
      },
    ],

    callbackUrl: `${hostUrl}${callbackURL}?sessionId=${sessionId}`,
    //audience,
    verifierDid:
      //"did:polygonid:polygon:amoy:2qb8zJTJCC2ZxaXx6Uj92ptybzjhapF1tHzZMBmY1w",
    //"did:polygonid:polygon:amoy:2qUkeEY3eeDELgCdgnRvTzFU1DURomnAXbzwxKCfBx",
    "did:polygonid:polygon:amoy:2qQ68JkRcf3xrHPQPWZei3YeVzHPP58wYNxx2mEouR",
    //"did:iden3:privado:main:28itzVLBHnMJV8sdjyffcAtWCx8HZ7btdKXxs7fJ6v",
  };
  // Encode the verification request to base64
  const base64EncodedVerificationRequest = btoa(
    JSON.stringify(verificationRequest)
  );

  // Open the Polygon ID Verification Web Wallet with the encoded verification request
  await open(`https://wallet.privado.id/#${base64EncodedVerificationRequest}`);

  const scope = request.body.scope ?? [];
  request.body.scope = [...scope, verificationRequest];

  //request.body.scope = [...scope, proofRequest];
  // Store auth request in map associated with session ID
  requestMap.set(`${sessionId}`, request);

  return res.status(200).set("Content-Type", "application/json").send(request);
}

// Callback verifies the proof after sign-in callbacks
async function callback(req, res) {
  // Get session ID from request
  const sessionId = req.query.sessionId;

  // get JWZ token params from the post request
  const raw = await getRawBody(req);
  const tokenStr = raw.toString().trim();
  //console.log(tokenStr);

  const ethURL = "https://rpc-amoy.polygon.technology/";
  const contractAddress = "0x1a4cC30f2aA0377b0c3bc9848766D90cb4404124";
  const keyDIR = "../keys";

  const ethStateResolver = new resolver.EthStateResolver(
    ethURL,
    contractAddress
  );

  const resolvers = {
    ["polygon:amoy"]: ethStateResolver,
  };

  // fetch authRequest from sessionID
  const authRequest = requestMap.get(`${sessionId}`);

  //const __dirname = path.resolve();
  // EXECUTE VERIFICATION
  const verifier = await auth.Verifier.newVerifier({
    stateResolver: resolvers,
    circuitsDir: path.join(__dirname, keyDIR),
    //circuitsDir: path.join(__dirname, "./circuits-dir"),
    ipfsGatewayURL: "https://ipfs.io",
  });
  try {
    const opts = {
      AcceptedStateTransitionDelay: 5 * 60 * 1000, // 5 minute
    };
    authResponse = await verifier.fullVerify(tokenStr, authRequest, opts);
  } catch (error) {
    console.log(error);
    return res.status(500).send(error);
  }
  return res
    .status(200)
    .set("Content-Type", "application/json")
    .send(authResponse);
}
