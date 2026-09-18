
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

const connection = new Connection(
  clusterApiUrl(NETWORK),
  "confirmed"
);

let provider = null;
let publicKey = null;
let mintAddress = null;

const $ = (id) => document.getElementById(id);

function log(message) {
  const el = $("status");

  if (el) {
    el.textContent = message;
  }
}

function getProvider() {
  if (window.phantom?.solana) {
    return window.phantom.solana;
  }

  if (window.solana?.isPhantom) {
    return window.solana;
  }

  return null;
}


// ==============================
// اتصال Phantom
// ==============================

async function connectPhantom() {
  try {

    provider = getProvider();

    if (!provider) {
      log(
        "Phantom پیدا نشد.\n\n" +
        "سایت را داخل مرورگر داخلی Phantom باز کن."
      );
      return;
    }

    const resp = await provider.connect();

    const walletKey =
      resp?.publicKey ||
      provider.publicKey;

    if (!walletKey) {
      throw new Error(
        "آدرس کیف پول از Phantom دریافت نشد."
      );
    }

    // تبدیل صریح به PublicKey
    publicKey =
      walletKey instanceof PublicKey
        ? walletKey
        : new PublicKey(walletKey.toString());

    $("create").disabled = false;
    $("mint").disabled = true;

    log(
      "کیف پول با موفقیت وصل شد.\n\n" +
      "آدرس:\n" +
      publicKey.toString().slice(0, 8) +
      "..." +
      publicKey.toString().slice(-6) +
      "\n\n" +
      "شبکه: Solana Devnet"
    );

  } catch (err) {

    console.error(
      "Phantom connection error:",
      err
    );

    log(
      "خطا در اتصال Phantom:\n\n" +
      (err?.message || String(err))
    );
  }
}


// ==============================
// ساخت تراکنش Mint
// ==============================

async function buildMintTransaction() {

  if (!provider || !publicKey) {
    throw new Error(
      "ابتدا Phantom را وصل کن."
    );
  }

  // Seed کوتاه و یکتا
  const seed =
    "nvdx" +
    Date.now().toString(36);

  // ساخت آدرس Mint
  const mint =
    await PublicKey.createWithSeed(
      publicKey,
      seed,
      TOKEN_PROGRAM_ID
    );

  // بررسی اینکه قبلاً وجود نداشته باشد
  const existing =
    await connection.getAccountInfo(mint);

  if (existing) {
    throw new Error(
      "این آدرس Mint قبلاً استفاده شده است.\nدوباره تلاش کن."
    );
  }

  // مقدار SOL لازم برای rent exemption
  const lamports =
    await getMinimumBalanceForRentExemptMint(
      connection
    );

  // دریافت blockhash
  const {
    blockhash,
    lastValidBlockHeight
  } =
    await connection.getLatestBlockhash(
      "confirmed"
    );

  // ساخت تراکنش
  const tx = new Transaction({
    feePayer: publicKey,
    recentBlockhash: blockhash
  });

  tx.lastValidBlockHeight =
    lastValidBlockHeight;

  // ایجاد حساب Mint
  tx.add(

    SystemProgram.createAccountWithSeed({
      fromPubkey: publicKey,

      basePubkey: publicKey,

      seed: seed,

      newAccountPubkey: mint,

      lamports: lamports,

      space: MINT_SIZE,

      programId: TOKEN_PROGRAM_ID
    }),

    // Initialize Mint
    createInitializeMintInstruction(
      mint,

      9,

      publicKey,

      publicKey,

      TOKEN_PROGRAM_ID
    )
  );

  return {
    tx,
    mint
  };
}


// ==============================
// ساخت Mint
// ==============================

async function createMint() {

  try {

    if (!provider || !publicKey) {
      throw new Error(
        "ابتدا Phantom را وصل کن."
      );
    }

    $("create").disabled = true;

    log(
      "در حال ساخت تراکنش...\n\n" +
      "لطفاً چند ثانیه صبر کن."
    );

    const {
      tx,
      mint
    } =
      await buildMintTransaction();


    // ==========================
    // شبیه‌سازی قبل از Phantom
    // ==========================

    log(
      "در حال بررسی تراکنش روی Solana Devnet..."
    );

    const simulation =
      await connection.simulateTransaction(
        tx,
        {
          sigVerify: false,
          replaceRecentBlockhash: true
        }
      );

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
        "شبیه‌سازی تراکنش ناموفق بود.\n\n" +
        "هیچ تراکنشی به Phantom ارسال نشد."
      );
    }


    // ==========================
    // ارسال به Phantom
    // ==========================

    log(
      "شبیه‌سازی موفق بود.\n\n" +
      "Phantom را برای تأیید باز می‌کنیم..."
    );

    const result =
      await provider.signAndSendTransaction(
        tx
      );

    const signature =
      result?.signature ||
      result;


    // ==========================
    // تأیید تراکنش
    // ==========================

    await connection.confirmTransaction(
      {
        signature,

        blockhash:
          tx.recentBlockhash,

        lastValidBlockHeight:
          tx.lastValidBlockHeight
      },

      "confirmed"
    );


    // ==========================
    // موفقیت
    // ==========================

    mintAddress =
      mint.toString();

    $("mint").disabled = true;

    log(
      "✅ Mint با موفقیت ساخته شد.\n\n" +

      "Mint Address:\n" +

      mintAddress +

      "\n\n" +

      "Transaction:\n" +

      signature +

      "\n\n" +

      "شبکه: Solana Devnet\n\n" +

      "مرحله Mint کردن 1 میلیارد NVDX فعلاً غیرفعال است."
    );

  } catch (err) {

    console.error(
      "Create Mint error:",
      err
    );

    log(
      "❌ خطا:\n\n" +
      (err?.message || String(err))
    );

  } finally {

    $("create").disabled =
      !publicKey;
  }
}


// ==============================
// Mint کردن توکن
// فعلاً غیرفعال
// ==============================

function mintOneBillion() {

  log(
    "این مرحله فعلاً غیرفعال است.\n\n" +
    "ابتدا باید Mint Address را بررسی کنیم."
  );
}


// ==============================
// شروع برنامه
// ==============================

window.addEventListener(
  "load",
  () => {

    provider =
      getProvider();

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
        "Phantom آماده است.\n\n" +
        "روی «اتصال Phantom» بزن."
      );

    } else {

      log(
        "Phantom پیدا نشد.\n\n" +
        "سایت را داخل مرورگر داخلی Phantom باز کن."
      );
    }
  }
);
