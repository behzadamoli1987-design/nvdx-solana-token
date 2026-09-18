import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
} from "https://esm.sh/@solana/web3.js@1.98.4";

import {
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
  createInitializeMintInstruction,
} from "https://esm.sh/@solana/spl-token@0.4.14";

const NETWORK = "devnet";
const connection = new Connection(clusterApiUrl(NETWORK), "confirmed");

let provider = null;
let publicKey = null;
let mintAddress = null;

const $ = (id) => document.getElementById(id);

function log(msg) {
  const el = $("status");
  if (el) el.textContent = msg;
}

function getProvider() {
  if (window.phantom?.solana) return window.phantom.solana;
  if (window.solana?.isPhantom) return window.solana;
  return null;
}

async function connectPhantom() {
  try {
    provider = getProvider();

    if (!provider) {
      log("Phantom پیدا نشد. این سایت را داخل مرورگر داخلی Phantom باز کن.");
      return;
    }

    const resp = await provider.connect();
    publicKey = resp.publicKey || provider.publicKey;

    if (!publicKey) {
      throw new Error("آدرس کیف پول از Phantom دریافت نشد.");
    }

    $("create").disabled = false;
    $("mint").disabled = true;

    log(
      `کیف پول وصل شد.\nآدرس: ${publicKey.toString().slice(0, 6)}...${publicKey
        .toString()
        .slice(-4)}\nشبکه: Solana Devnet`
    );
  } catch (err) {
    console.error("Phantom connect error:", err);
    log(`اتصال لغو شد یا ناموفق بود:\n${err?.message || String(err)}`);
  }
}

async function buildMintTransaction() {
  if (!provider || !publicKey) {
    throw new Error("ابتدا Phantom را وصل کن.");
  }

  const seed = `nvdx${Date.now().toString(36)}`.slice(0, 32);

  const mint = await PublicKey.createWithSeed(
    publicKey,
    seed,
    TOKEN_PROGRAM_ID
  );

  const existing = await connection.getAccountInfo(mint);

  if (existing) {
    throw new Error("این آدرس Mint قبلاً استفاده شده است؛ دوباره تلاش کن.");
  }

  const lamports =
    await getMinimumBalanceForRentExemptMint(connection);

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction({
    feePayer: publicKey,
    recentBlockhash: blockhash,
  });

  tx.lastValidBlockHeight = lastValidBlockHeight;

  tx.add(
    SystemProgram.createAccountWithSeed({
      fromPubkey: publicKey,
      basePubkey: publicKey,
      seed,
      newAccountPubkey: mint,
      lamports,
      space: MINT_SIZE,
      programId: TOKEN_PROGRAM_ID,
    }),

    createInitializeMintInstruction(
      mint,
      9,
      publicKey,
      publicKey,
      TOKEN_PROGRAM_ID
    )
  );

  return { tx, mint };
}

async function createMint() {
  try {
    if (!provider || !publicKey) {
      throw new Error("ابتدا Phantom را وصل کن.");
    }

    $("create").disabled = true;

    log("در حال ساخت و شبیه‌سازی تراکنش...");

    const { tx, mint } = await buildMintTransaction();

    const simulation = await connection.simulateTransaction(tx, {
      sigVerify: false,
      replaceRecentBlockhash: true,
    });

    if (simulation.value.err) {
      console.error(
        "Simulation error:",
        simulation.value.err
      );

      console.error(
        "Simulation logs:",
        simulation.value.logs
      );

      throw new Error(
        "شبیه‌سازی تراکنش ناموفق بود؛ هیچ تراکنشی به Phantom ارسال نشد."
      );
    }

    log(
      "شبیه‌سازی موفق شد. حالا Phantom را برای تأیید باز می‌کنیم..."
    );

    const result = await provider.signAndSendTransaction(tx);

    const signature = result.signature || result;

    await connection.confirmTransaction(
      {
        signature,
        blockhash: tx.recentBlockhash,
        lastValidBlockHeight: tx.lastValidBlockHeight,
      },
      "confirmed"
    );

    mintAddress = mint.toString();

    $("mint").disabled = true;

    log(
      `Mint با موفقیت ساخته شد.\n\nMint Address:\n${mintAddress}\n\nSignature:\n${signature}\n\nفعلاً مرحله Mint کردن 1 میلیارد NVDX غیرفعال است.`
    );

  } catch (err) {
    console.error("Create mint error:", err);

    log(
      `خطا:\n${err?.message || String(err)}`
    );

  } finally {
    $("create").disabled = !publicKey;
  }
}

function mintOneBillion() {
  log(
    "فعلاً این مرحله غیرفعال است تا Mint Address بررسی شود."
  );
}

window.addEventListener("load", () => {

  provider = getProvider();

  $("connect").addEventListener(
    "click",
    connectPhantom
  );

  $("create").addEventListener(
    "click",
    createMint
  );

  $("mint").addEventListener(
    "click",
    mintOneBillion
  );

  $("create").disabled = true;
  $("mint").disabled = true;

  if (provider) {

    log(
      "Phantom آماده است؛ روی «اتصال Phantom» بزن."
    );

  } else {

    log(
      "Phantom پیدا نشد. سایت را داخل مرورگر داخلی Phantom باز کن."
    );

  }

});
