import {
  Connection,
  PublicKey,
  Keypair,
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


const $ = (id) => document.getElementById(id);

const connectButton = $("connect");
const createButton = $("create");
const mintButton = $("mint");
const statusBox = $("status");

const connection = new Connection(
  clusterApiUrl("devnet"),
  "confirmed"
);

let provider = null;
let publicKey = null;
let mintAddress = null;


/* =========================
   Phantom Provider
========================= */

function getProvider() {
  if (window.phantom?.solana) {
    return window.phantom.solana;
  }

  if (window.solana) {
    return window.solana;
  }

  return null;
}


/* =========================
   اتصال Phantom
========================= */

async function connectPhantom() {
  try {
    provider = getProvider();

    if (!provider) {
      throw new Error(
        "Phantom پیدا نشد. صفحه را داخل مرورگر داخلی Phantom باز کنید."
      );
    }

    const resp = await provider.connect();

    const walletAddress =
      resp?.publicKey ||
      provider.publicKey;

    if (!walletAddress) {
      throw new Error("آدرس کیف پول دریافت نشد.");
    }

    publicKey =
      walletAddress instanceof PublicKey
        ? walletAddress
        : new PublicKey(walletAddress.toString());

    statusBox.textContent =
      "✅ کیف پول با موفقیت وصل شد.\n\n" +
      "آدرس:\n" +
      publicKey.toString() +
      "\n\nشبکه: Solana Devnet";

    createButton.disabled = false;

  } catch (error) {

    console.error(error);

    statusBox.textContent =
      "❌ خطا در اتصال:\n\n" +
      (error?.message || String(error));
  }
}


/* =========================
   ساخت Mint
========================= */

async function createMint() {

  try {

    if (!provider || !publicKey) {
      throw new Error(
        "ابتدا Phantom را متصل کنید."
      );
    }

    createButton.disabled = true;

    statusBox.textContent =
      "⏳ در حال آماده‌سازی Mint...\n\n" +
      "لطفاً منتظر بمانید.";

    /*
      ساخت Keypair جدید برای Mint
    */

    const mintKeypair = Keypair.generate();

    mintAddress = mintKeypair.publicKey;


    /*
      محاسبه Rent
    */

    const lamports =
      await getMinimumBalanceForRentExemptMint(
        connection
      );


    /*
      دریافت Blockhash
    */

    const latestBlockhash =
      await connection.getLatestBlockhash(
        "confirmed"
      );


    /*
      ساخت حساب Mint
    */

    const createMintAccountInstruction =
      SystemProgram.createAccount({

        fromPubkey: publicKey,

        newAccountPubkey:
          mintKeypair.publicKey,

        space: MINT_SIZE,

        lamports: lamports,

        programId:
          TOKEN_PROGRAM_ID
      });


    /*
      Initialize Mint

      decimals = 9

      mint authority = کیف پول کاربر

      freeze authority = کیف پول کاربر
    */

    const initializeMintInstruction =
      createInitializeMintInstruction(

        mintKeypair.publicKey,

        9,

        publicKey,

        publicKey,

        TOKEN_PROGRAM_ID
      );


    /*
      ساخت تراکنش
    */

    const transaction =
      new Transaction({

        feePayer: publicKey,

        recentBlockhash:
          latestBlockhash.blockhash,

        lastValidBlockHeight:
          latestBlockhash.lastValidBlockHeight

      }).add(

        createMintAccountInstruction,

        initializeMintInstruction

      );


    /*
      Mint Keypair باید خودش این قسمت
      از تراکنش را امضا کند.
    */

    transaction.partialSign(
      mintKeypair
    );


    statusBox.textContent =
      "🔐 تراکنش آماده است.\n\n" +
      "Mint Address:\n" +
      mintKeypair.publicKey.toString() +
      "\n\n" +
      "اکنون Phantom باید تراکنش را نمایش دهد.";


    /*
      ارسال به Phantom
    */

    const result =
      await provider.signAndSendTransaction(
        transaction
      );


    /*
      تأیید تراکنش
    */

    await connection.confirmTransaction(
      {
        signature: result.signature,
        blockhash:
          latestBlockhash.blockhash,
        lastValidBlockHeight:
          latestBlockhash.lastValidBlockHeight
      },
      "confirmed"
    );


    statusBox.textContent =
      "✅ Mint با موفقیت ساخته شد!\n\n" +
      "Mint Address:\n" +
      mintKeypair.publicKey.toString() +
      "\n\n" +
      "Transaction:\n" +
      result.signature +
      "\n\n" +
      "شبکه: Solana Devnet";


    /*
      فعلاً دکمه Mint کردن توکن‌ها
      فعال نمی‌شود.
    */

    mintButton.disabled = true;


  } catch (error) {

    console.error(
      "CREATE MINT ERROR:",
      error
    );

    createButton.disabled = false;

    statusBox.textContent =
      "❌ خطا در ساخت Mint:\n\n" +
      (error?.message || String(error)) +
      "\n\n" +
      "جزئیات فنی در Console ثبت شد.";
  }
}


/* =========================
   دکمه‌ها
========================= */

connectButton.addEventListener(
  "click",
  connectPhantom
);

createButton.addEventListener(
  "click",
  createMint
);


/*
  فعلاً غیرفعال
*/

mintButton.disabled = true;


/* =========================
   بررسی اولیه
========================= */

window.addEventListener(
  "load",
  () => {

    provider = getProvider();

    if (provider) {

      statusBox.textContent =
        "Phantom آماده است.";

    } else {

      statusBox.textContent =
        "Phantom پیدا نشد.\n\n" +
        "این صفحه را داخل مرورگر داخلی Phantom باز کنید.";
    }
  }
);
