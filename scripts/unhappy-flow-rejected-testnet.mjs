import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { uploadArtifactWithWalrus } from "./walrus-upload.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const defaultEnvPath = path.join(projectRoot, "apps/web/.env.local");

function readEnvFile(envPath) {
  const vars = {};
  if (!fs.existsSync(envPath)) return vars;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    vars[key] = value;
  }
  return vars;
}

function required(name, value) {
  if (!value) throw new Error(`Missing required value: ${name}`);
  return value;
}

async function exec(client, signer, makeTx, label) {
  const maxAttempts = 5;
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const tx = await makeTx();
      const res = await client.signAndExecuteTransaction({
        transaction: tx,
        signer,
        include: {
          effects: true,
          objectChanges: true,
        },
      });
      const txResult = unwrapTxResult(res);
      const status = txResult.status?.success;
      if (!status) {
        throw new Error(`${label} failed: ${JSON.stringify(txResult.status)}`);
      }
      await client.waitForTransaction({ digest: txResult.digest, timeout: 60_000 });
      console.log(`[ok] ${label}: ${txResult.digest}`);
      return txResult;
    } catch (error) {
      lastError = error;
      const retryable = isRetryableRpcError(error);
      if (!retryable || attempt === maxAttempts) break;
      const delayMs = 700 * 2 ** (attempt - 1);
      console.log(`[retry] ${label} attempt ${attempt}/${maxAttempts}, waiting ${delayMs}ms...`);
      await sleep(delayMs);
    }
  }
  throw lastError ?? new Error(`${label} failed`);
}

function unwrapTxResult(result) {
  if (result?.$kind === "Transaction" && result.Transaction) return result.Transaction;
  return result;
}

async function pickCreatedObjectId(client, txResult, typeSuffix) {
  const changed = txResult?.effects?.changedObjects ?? [];
  const createdIds = changed
    .filter((c) => c?.idOperation === "Created" && c?.objectId)
    .map((c) => c.objectId);
  for (const objectId of createdIds) {
    const obj = await client.getObject({
      objectId,
      include: { json: true },
    });
    const t = String(obj.object?.type ?? "");
    if (t.endsWith(typeSuffix)) return objectId;
  }
  throw new Error(`Could not find created object for suffix ${typeSuffix}`);
}

function isRetryableRpcError(error) {
  if (!error || typeof error !== "object") return false;
  const maybe = error;
  const status = Number(maybe.status ?? 0);
  if (status === 408 || status === 429 || status === 502 || status === 503 || status === 504) return true;
  if (status >= 500 && status < 600) return true;
  const msg = String(maybe.message ?? "");
  if (msg.includes("Transaction needs to be rebuilt because object")) return true;
  return /timeout|temporar|gateway|ECONNRESET|ENOTFOUND|network/i.test(msg);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pickLargestSuiCoin(client, owner) {
  const coins = [];
  let cursor = null;
  do {
    const page = await client.listCoins({
      owner,
      coinType: "0x2::sui::SUI",
      cursor,
      limit: 50,
    });
    coins.push(...page.objects);
    cursor = page.hasNextPage ? page.cursor : null;
  } while (cursor);
  if (coins.length === 0) throw new Error("No SUI coins found for sender.");
  let best = coins[0];
  let bestBal = BigInt(best.balance);
  for (const c of coins) {
    const bal = BigInt(c.balance);
    if (bal > bestBal) {
      best = c;
      bestBal = bal;
    }
  }
  return {
    coinObjectId: best.objectId,
    version: best.version,
    digest: best.digest,
    balance: bestBal,
  };
}

async function main() {
  const envFromFile = readEnvFile(defaultEnvPath);
  const packageId = required(
    "VITE_AGENTGUILD_PACKAGE_ID",
    process.env.VITE_AGENTGUILD_PACKAGE_ID || envFromFile.VITE_AGENTGUILD_PACKAGE_ID
  );
  const boardId = required(
    "VITE_AGENTGUILD_BOARD_ID",
    process.env.VITE_AGENTGUILD_BOARD_ID || envFromFile.VITE_AGENTGUILD_BOARD_ID
  );
  const clockId = process.env.VITE_SUI_CLOCK_ID || envFromFile.VITE_SUI_CLOCK_ID || "0x6";
  const suiPrivateKey = required("SUI_PRIVATE_KEY", process.env.SUI_PRIVATE_KEY);
  const gasReserveMist = BigInt(process.env.UNHAPPY_FLOW_GAS_RESERVE_MIST || "150000000");
  const budgetMist = BigInt(process.env.UNHAPPY_FLOW_BUDGET_MIST || "200000000");
  const rewardMist = BigInt(process.env.UNHAPPY_FLOW_REWARD_MIST || "100000000");
  const walrusEpochs = Number(process.env.UNHAPPY_FLOW_WALRUS_EPOCHS || "3");
  const walrusRelayHost =
    process.env.UNHAPPY_FLOW_WALRUS_RELAY_HOST || "https://upload-relay.testnet.walrus.space";

  if (rewardMist > budgetMist) throw new Error("UNHAPPY_FLOW_REWARD_MIST must be <= UNHAPPY_FLOW_BUDGET_MIST");

  const decoded = decodeSuiPrivateKey(suiPrivateKey);
  const signer = Ed25519Keypair.fromSecretKey(decoded.secretKey);
  const sender = signer.getPublicKey().toSuiAddress();
  const client = new SuiGrpcClient({
    network: "testnet",
    baseUrl: "https://fullnode.testnet.sui.io:443",
  });

  console.log("Running AgentGuild UNHAPPY (rejected) flow on testnet");
  console.log(`sender=${sender}`);
  console.log(`packageId=${packageId}`);
  console.log(`boardId=${boardId}`);

  const unique = Date.now();
  const handle = `agent-reject-${unique}`;
  const title = `Unhappy Rejected Flow ${unique}`;

  const profileRes = await exec(
    client,
    signer,
    () => {
      const tx = new Transaction();
      tx.moveCall({
        target: `${packageId}::profile::create_profile`,
        arguments: [tx.pure.string(handle), tx.pure.string(`https://example.com/reject-${unique}.json`)],
      });
      return tx;
    },
    "create_profile"
  );
  const profileId = await pickCreatedObjectId(client, profileRes, "::profile::AgentProfile");

  const taskRes = await exec(
    client,
    signer,
    () => {
      const tx = new Transaction();
      tx.moveCall({
        target: `${packageId}::task::create_task`,
        arguments: [
          tx.object(boardId),
          tx.pure.string(title),
          tx.pure.string("Automated unhappy rejected-flow task"),
          tx.pure.address(sender),
          tx.pure.u64(budgetMist),
          tx.pure.u64(BigInt(Date.now() + 24 * 60 * 60 * 1000)),
        ],
      });
      return tx;
    },
    "create_task"
  );
  const taskId = await pickCreatedObjectId(client, taskRes, "::task::Task");

  const roleRes = await exec(
    client,
    signer,
    () => {
      const tx = new Transaction();
      tx.moveCall({
        target: `${packageId}::task::add_role`,
        arguments: [tx.object(taskId), tx.pure.string("Analyst"), tx.pure.u64(rewardMist)],
      });
      return tx;
    },
    "add_role"
  );
  const roleId = await pickCreatedObjectId(client, roleRes, "::task::Role");

  const fundRes = await exec(
    client,
    signer,
    async () => {
      const coin = await pickLargestSuiCoin(client, sender);
      const maxSpendable = coin.balance - gasReserveMist;
      if (maxSpendable < budgetMist) {
        throw new Error(
          `Insufficient coin balance for requested budget. required=${budgetMist.toString()} available_after_reserve=${maxSpendable.toString()}`
        );
      }
      const tx = new Transaction();
      tx.setGasPayment([{ objectId: coin.coinObjectId, version: coin.version, digest: coin.digest }]);
      tx.setGasBudget(100_000_000);
      const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(budgetMist)]);
      tx.moveCall({
        target: `${packageId}::escrow::fund_task`,
        arguments: [tx.object(taskId), payment],
      });
      return tx;
    },
    "fund_task"
  );
  const escrowId = await pickCreatedObjectId(client, fundRes, "::escrow::Escrow");

  await exec(
    client,
    signer,
    () => {
      const tx = new Transaction();
      tx.moveCall({
        target: `${packageId}::task::join_role`,
        arguments: [tx.object(roleId), tx.object(taskId)],
      });
      return tx;
    },
    "join_role"
  );

  const artifactRes = await exec(
    client,
    signer,
    async () => {
      const artifactPayload = `unhappy-flow:${unique}:task=${taskId}:role=${roleId}:sender=${sender}`;
      const walrusBlob = await uploadArtifactWithWalrus({
        signer,
        contents: artifactPayload,
        epochs: walrusEpochs,
        relayHost: walrusRelayHost,
      });
      console.log(`[walrus] uploaded blobId=${walrusBlob.blobId}`);
      const tx = new Transaction();
      tx.moveCall({
        target: `${packageId}::artifact::submit_artifact`,
        arguments: [
          tx.object(taskId),
          tx.object(roleId),
          tx.pure.string(walrusBlob.uri),
          tx.pure.string(walrusBlob.contentHash),
          tx.object(clockId),
        ],
      });
      return tx;
    },
    "submit_artifact"
  );
  const artifactId = await pickCreatedObjectId(client, artifactRes, "::artifact::Artifact");

  await exec(
    client,
    signer,
    () => {
      const tx = new Transaction();
      tx.moveCall({
        target: `${packageId}::artifact::verify_artifact`,
        arguments: [
          tx.object(taskId),
          tx.object(roleId),
          tx.object(artifactId),
          tx.pure.bool(false),
          tx.object(clockId),
        ],
      });
      return tx;
    },
    "verify_artifact(reject)"
  );

  await exec(
    client,
    signer,
    () => {
      const tx = new Transaction();
      tx.moveCall({
        target: `${packageId}::task::finalize_task`,
        arguments: [tx.object(taskId)],
      });
      return tx;
    },
    "finalize_task"
  );

  let claimFailedAsExpected = false;
  try {
    await exec(
      client,
      signer,
      () => {
        const tx = new Transaction();
        tx.moveCall({
          target: `${packageId}::escrow::claim_role_reward`,
          arguments: [
            tx.object(taskId),
            tx.object(roleId),
            tx.object(escrowId),
            tx.object(profileId),
          ],
        });
        return tx;
      },
      "claim_role_reward(should_fail)"
    );
  } catch (e) {
    claimFailedAsExpected = true;
    console.log("[ok] claim_role_reward failed as expected for rejected role");
    console.log(`reason=${e instanceof Error ? e.message : String(e)}`);
  }

  if (!claimFailedAsExpected) {
    throw new Error("Expected claim_role_reward to fail, but it succeeded.");
  }

  console.log("Unhappy rejected flow completed (expected failure validated).");
  console.log(JSON.stringify({ profileId, taskId, roleId, artifactId, escrowId }, null, 2));
}

main().catch((err) => {
  console.error("Unhappy rejected flow failed:");
  console.error(err);
  process.exit(1);
});
