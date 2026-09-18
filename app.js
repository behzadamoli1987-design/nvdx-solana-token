import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  clusterApiUrl
} from "https://esm.sh/@solana/web3.js@1.98.4";

import {
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
  createInitializeMintInstruction
} from "https://esm.sh/@solana/spl-token@0.4.14";


const connectButton = document.getElementById("connect");
const createButton = document.getElementById("create");
const mintButton = document.getElementById("mint");
const statusBox = document.getElementById("status");


const connection = new Connection(
  clusterApiUrl("devnet"),
  "confirmed"
);


let provider = null;
let publicKey = null;
let mintAddress = null;


function getProvider() {

  if (window.phantom && window.phantom.solana) {
    return window.phantom.solana;
  }

  if (window.solana) {
    return window.solana;
  }

  return null;
}


async function connectPhantom() {

  try {

    provider = getProvider();

    if (!provider) {

      throw new Error(
        "Phantom پیدا نشد. صفحه را داخل مرورگر داخلی Phantom باز کنید."
      );

    }


    const response = await provider.connect();


    const walletAddress =
      response?.publicKey ||
      provider.publicKey;


    if (!walletAddress) {

      throw new Error(
        "آدرس کیف پول دریافت نشد."
      );

    }


    publicKey =
      walletAddress instanceof PublicKey
        ? walletAddress
        : new PublicKey(
            walletAddress.toString()
          );


    statusBox.textContent =
      "✅ کیف پول با موفقیت وصل شد.\n\n" +
      "آدرس:\n" +
      publicKey.toString() +
      "\n\n" +
      "شبکه: Solana Devnet";


    createButton.disabled = false;


  } catch (error) {

    console.error(
      "CONNECT ERROR:",
      error
    );


    statusBox.textContent =
      "❌ خطا در اتصال:\n\n" +
      (error?.message || String(error));

  }

}


async function createMint() {

  try {

    if (!provider || !publicKey) {

      throw new Error(
        "ابتدا Phantom را متصل کنید."
      );

    }


    createButton.disabled = true;


    statusBox.textContent =
      "⏳ مرحله 1/6\n" +
      "در حال آماده‌سازی Mint...";


    /*
      ساخت کلید اختصاصی Mint
    */

    const mintKeypair =
      Keypair.generate();


    mintAddress =
      mintKeypair.publicKey;


    statusBox.textContent =
      "⏳ مرحله 2/6\n" +
      "Mint Address ساخته شد:\n\n" +
      mintKeypair.publicKey.toString();


    /*
      مقدار SOL مورد نیاز برای rent
    */

    const lamports =
      await getMinimumBalanceForRentExemptMint(
        connection
      );


    statusBox.textContent =
      "⏳ مرحله 3/6\n" +
      "در حال دریافت Blockhash و آماده‌سازی تراکنش...";


    /*
      دریافت Blockhash جدید
    */

    const latestBlockhash =
      await connection.getLatestBlockhash(
        "confirmed"
      );


    /*
      ساخت حساب Mint روی Solana
    */

    const createMintAccountInstruction =
      SystemProgram.createAccount({

        fromPubkey:
          publicKey,

        newAccountPubkey:
          mintKeypair.publicKey,

        space:
          MINT_SIZE,

        lamports:
          lamports,

        programId:
          TOKEN_PROGRAM_ID

      });


    /*
      Initialize کردن Mint

      Decimals = 9
      Mint Authority = کیف پول شما
      Freeze Authority = کیف پول شما
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
      ساخت Transaction
    */

    const transaction =
      new Transaction();


    /*
      این سه مقدار را مستقیماً
      روی Transaction قرار می‌دهیم
    */

    transaction.feePayer =
      publicKey;


    transaction.recentBlockhash =
      latestBlockhash.blockhash
