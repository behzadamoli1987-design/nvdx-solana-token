const {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
} = solanaWeb3;

const {
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
  createInitializeMintInstruction,
} = splToken;

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
  return window.phantom?.solana || window.solana || null;
}

async function connectPhantom() {
  try {
    provider = getProvider();

    if (!provider) {
      log("Phantom پیدا نشد. سایت را داخل مرورگر داخلی Phantom باز کن.");
      return;
    }

    const resp = await provider.connect();
    publicKey = resp.publicKey;

    $("wallet").textContent =
      `متصل: ${publicKey.toString().slice(0, 6)}...${publicKey.toString().slice(-4)}`;

    $("createMint").disabled = false;
    log("کیف پول با موفقیت وصل شد.");
  } catch (err) {
    console.error(err);
    log(`اتصال لغو شد: ${err?.message || err}`);
  }
}

/*
  Phantom compatibility fix:
  createAccountWithSeed creates the Mint account without a second
  Keypair signer. Phantom recommends keeping transactions to one signer
  when its transaction-simulation warning appears.
*/
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

  if (await connection.getAccountInfo(mint)) {
    throw new Error("آدرس Mint قبلاً استفاده شده؛ دوباره تلاش کن.");
  }

  const lamports = await getMinimumBalanceForRentExemptMint(connection);

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction({
    feePayer: publicKey,
    recentBlockhash: blockhash,
  });

  tx.lastValidBlockHeight = lastValidBlockHeight;

  // تنها signer این تراکنش، کیف پول متصل‌شده است.
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

    $("createMint").disabled = true;
    log("در حال ساخت و بررسی تراکنش...");

    const { tx, mint } = await buildMintTransaction();

    // Preflight simulation طبق راهنمای Phantom.
    const simulation = await connection.simulateTransaction(tx, {
      sigVerify: false,
      replaceRecentBlockhash: true,
    });

    if (simulation.value.err) {
      console.error("Simulation error:", simulation.value.err, simulation.value.logs);
      throw new Error(
        "شبیه‌سازی تراکنش ناموفق بود؛ هیچ تراکنشی به Phantom ارسال نشد."
      );
    }

    log("شبیه‌سازی موفق بود. Phantom را برای تأیید باز می‌کنیم...");

    // فقط Phantom wallet امضا می‌کند.
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

    $("mintAddress").textContent = `Mint Address: ${mintAddress}`;
    $("mintAddress").style.display = "block";

    // فعلاً مرحله Mint کردن 1B را فعال نمی‌کنیم.
    $("mintTokens").disabled = true;

    log("Mint با موفقیت ساخته شد. فعلاً ۱ میلیارد NVDX را Mint نکن.");

  } catch (err) {
    console.error(err);
    log(`خطا: ${err?.message || err}`);
  } finally {
    $("createMint").disabled = false;
  }
}

function mintOneBillion() {
  log("فعلاً این مرحله متوقف است تا Mint Address را بررسی کنیم.");
}

window.addEventListener("load", () => {
  provider = getProvider();

  $("connect").addEventListener("click", connectPhantom);
  $("createMint").addEventListener("click", createMint);
  $("mintTokens").addEventListener("click", mintOneBillion);

  $("createMint").disabled = true;
  $("mintTokens").disabled = true;

  if (!provider) {
    log("سایت را داخل مرورگر داخلی Phantom باز کن.");
  } else {
    log("Phantom آماده است؛ روی «اتصال Phantom» بزن.");
  }
});
