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


// ========================================
// تنظیمات
// ========================================

const NETWORK = "devnet";

const connection = new Connection(
  clusterApiUrl(NETWORK),
  "confirmed"
);


// ========================================
// متغیرها
// ========================================

let provider = null;
let publicKey = null;
let mintAddress = null;


// ========================================
// ابزار ساده برای HTML
// ========================================

function $(id) {
  return document.getElementById(id);
}


function log(message) {
  const status = $("status");

  if (status) {
    status.textContent = message;
  }
}


// ========================================
// پیدا کردن Phantom
// ========================================

function getProvider() {

  if (window.phantom?.solana) {
    return window.phantom.solana;
  }

  if (
    window.solana &&
    window.solana.isPhantom
  ) {
    return window.solana;
  }

  return null;
}


// ========================================
// اتصال Phantom
// ========================================

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


    const response =
      await provider.connect();


    const walletAddress =
      response?.publicKey ||
      provider.publicKey;


    if (!walletAddress) {

      throw new Error(
        "آدرس کیف پول از Phantom دریافت نشد."
      );
    }


    // تبدیل صریح به PublicKey
    publicKey =
      walletAddress instanceof PublicKey
        ? walletAddress
        : new PublicKey(
            walletAddress.toString()
          );


    $("create").disabled = false;

    $("mint").disabled = true;


    const address =
      publicKey.toString();


    log(
      "✅ کیف پول با موفقیت وصل شد.\n\n" +
      "آدرس:\n" +
      address.slice(0, 8) +
      "..." +
      address.slice(-6) +
      "\n\n" +
      "شبکه: Solana Devnet"
    );

  } catch (error) {

    console.error(
      "Phantom connection error:",
      error
    );


    log(
      "❌ خطا در اتصال Phantom:\n\n" +
      (
        error?.message ||
        String(error)
      )
    );
  }
}


// ========================================
// ساخت تراکنش Mint
// ========================================

async function buildMintTransaction() {

  if (!provider || !publicKey) {

    throw new Error(
      "ابتدا Phantom را وصل کن."
    );
  }


  // Seed یکتا برای ساخت آدرس Mint
  const seed =
    (
      "nvdx" +
      Date.now().toString(36)
    ).slice(0, 32);


  // ساخت آدرس Mint
  const mint =
    await PublicKey.createWithSeed(
      publicKey,
      seed,
      TOKEN_PROGRAM_ID
    );


  // بررسی وجود قبلی
  const existing =
    await connection.getAccountInfo(
      mint
    );


  if (existing) {

    throw new Error(
      "این آدرس Mint قبلاً استفاده شده است.\n\n" +
      "دوباره تلاش کن."
    );
  }


  // مقدار SOL لازم برای rent
  const lamports =
    await getMinimumBalanceForRentExemptMint(
      connection
    );


  // دریافت blockhash
  const blockhashData =
    await connection.getLatestBlockhash(
      "confirmed"
    );


  const blockhash =
    blockhashData.blockhash;


  const lastValidBlockHeight =
    blockhashData.lastValidBlockHeight;


  // ساخت Transaction
  const transaction =
    new Transaction({

      feePayer:
        publicKey,

      recentBlockhash:
        blockhash
    });


  transaction.lastValidBlockHeight =
    lastValidBlockHeight;


  // ======================================
  // ایجاد حساب Mint
  // ======================================

  transaction.add(

    SystemProgram.createAccountWithSeed({

      fromPubkey:
        publicKey,

      basePubkey:
        publicKey,

      seed:
        seed,

      newAccountPubkey:
        mint,

      lamports:
        lamports,

      space:
        MINT_SIZE,

      programId:
        TOKEN_PROGRAM_ID
    }),


    // ====================================
    // Initialize Mint
    // ====================================

    createInitializeMintInstruction(

      mint,

      9,

      publicKey,

      publicKey,

      TOKEN_PROGRAM_ID
    )
  );


  return {

    transaction,

    mint,

    blockhash,

    lastValidBlockHeight
  };
}


// ========================================
// ساخت Mint
// ========================================

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
      "لطفاً صبر کن."
    );


    // ساخت تراکنش
    const {

      transaction,

      mint,

      blockhash,

      lastValidBlockHeight

    } =
      await buildMintTransaction();


    // ====================================
    // شبیه‌سازی تراکنش
    // ====================================

    log(
      "در حال بررسی تراکنش روی Solana Devnet..."
    );


    /*
      نکته مهم:

      اینجا عمداً فقط Transaction را
      به simulateTransaction می‌دهیم.

      آرگومان config قبلی باعث
      Invalid arguments می‌شد.
    */

    const simulation =
      await connection.simulateTransaction(
        transaction
      );


    // ====================================
    // بررسی نتیجه Simulation
    // ====================================

    if (simulation.value.err) {

      console.error(
        "Simulation error:",
        simulation.value.err
      );


      console.error(
        "Simulation logs:",
        simulation.value.logs
      );


      let details =
        "شبیه‌سازی تراکنش ناموفق بود.";


      if (
        simulation.value.logs &&
        simulation.value.logs.length
      ) {

        details +=
          "\n\nLogs:\n" +
          simulation.value.logs.join(
            "\n"
          );
      }


      throw new Error(
        details
      );
    }


    // ====================================
    // Simulation موفق
    // ====================================

    log(
      "✅ شبیه‌سازی موفق بود.\n\n" +
      "در حال باز کردن Phantom برای تأیید..."
    );


    // ====================================
    // ارسال به Phantom
    // ====================================

    const result =
      await provider.signAndSendTransaction(
        transaction
      );


    const signature =
      result?.signature ||
      result;


    if (!signature) {

      throw new Error(
        "Phantom امضای تراکنش را برنگرداند."
      );
    }


    // ====================================
    // تأیید تراکنش روی Devnet
    // ====================================

    log(
      "تراکنش ارسال شد.\n\n" +
      "در حال انتظار برای تأیید Solana..."
    );


    await connection.confirmTransaction(

      {
        signature:
          signature,

        blockhash:
          blockhash,

        lastValidBlockHeight:
          lastValidBlockHeight
      },

      "confirmed"
    );


    // ====================================
    // موفقیت نهایی
    // ====================================

    mintAddress =
      mint.toString();


    $("mint").disabled = true;


    log(

      "✅ Mint با موفقیت ساخته شد!\n\n" +

      "Mint Address:\n" +

      mintAddress +

      "\n\n" +

      "Transaction:\n" +

      signature +

      "\n\n" +

      "شبکه:\n" +

      "Solana Devnet\n\n" +

      "⚠️ مرحله Mint کردن 1 میلیارد NVDX فعلاً غیرفعال است."
    );


    console.log(
      "Mint Address:",
      mintAddress
    );


    console.log(
      "Transaction Signature:",
      signature
    );

  } catch (error) {

    console.error(
      "Create Mint error:",
      error
    );


    log(

      "❌ خطا:\n\n" +

      (
        error?.message ||
        String(error)
      )
    );

  } finally {

    $("create").disabled =
      !publicKey;
  }
}


// ========================================
// Mint کردن 1 میلیارد NVDX
// فعلاً غیرفعال
// ========================================

function mintOneBillion() {

  log(

    "این مرحله فعلاً غیرفعال است.\n\n" +

    "ابتدا باید Mint Address را بررسی کنیم."
  );
}


// ========================================
// شروع برنامه
// ========================================

window.addEventListener(
  "load",
  () => {

    provider =
      getProvider();


    const connectButton =
      $("connect");

    const createButton =
      $("create");

    const mintButton =
      $("mint");


    if (connectButton) {

      connectButton.addEventListener(
        "click",
        connectPhantom
      );
    }


    if (createButton) {

      createButton.addEventListener(
        "click",
        createMint
      );
    }


    if (mintButton) {

      mintButton.addEventListener(
        "click",
        mintOneBillion
      );
    }


    if (createButton) {

      createButton.disabled =
        true;
    }


    if (mintButton) {

      mintButton.disabled =
        true;
    }


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
