import { SuiGrpcClient } from "@mysten/sui/grpc";
import { walrus } from "@mysten/walrus";

export async function uploadArtifactWithWalrus({
  signer,
  contents,
  epochs = 3,
  relayHost = "https://upload-relay.testnet.walrus.space",
}) {
  const client = new SuiGrpcClient({
    network: "testnet",
    baseUrl: "https://fullnode.testnet.sui.io:443",
  }).$extend(
    walrus({
      uploadRelay: {
        host: relayHost,
        sendTip: { max: 1_000 },
      },
    })
  );

  const blob = new TextEncoder().encode(contents);
  const { blobId } = await client.walrus.writeBlob({
    blob,
    deletable: false,
    epochs,
    signer,
  });

  return {
    blobId,
    uri: `walrus://blob/${blobId}`,
    contentHash: `walrus:${blobId}`,
  };
}
