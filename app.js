import {
  Connection, PublicKey, Transaction, SystemProgram,
  Keypair
} from "https://esm.sh/@solana/web3.js@1.98.4";
import {
  TOKEN_PROGRAM_ID, MINT_SIZE, getMinimumBalanceForRentExemptMint,
  createInitializeMint2Instruction, createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress, createMintToInstruction
} from "https://esm.sh/@solana/spl-token@0.4.14";

const RPC = "https://api.devnet.solana.com"; // SAFE TEST NETWORK
const connection = new Connection(RPC, "confirmed");
const provider = window.phantom?.solana || window.solana;
let wallet = null, mint = null;

const $ = id => document.getElementById(id);
function msg(x){ $("status").textContent = x; }

$("connect").onclick = async () => {
  if(!provider) return msg("Phantom پیدا نشد. Phantom را نصب/باز کن.");
  try {
    const r = await provider.connect();
    wallet = new PublicKey(r.publicKey.toString());
    $("create").disabled = false;
    msg("متصل شد:\n" + wallet.toBase58() + "\n\nشبکه: Devnet");
  } catch(e){ msg("اتصال لغو شد یا خطا رخ داد:\n"+e.message); }
};

$("create").onclick = async () => {
  if(!wallet) return;
  try{
    mint = Keypair.generate();
    const lamports = await getMinimumBalanceForRentExemptMint(connection);
    const tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: wallet,
        newAccountPubkey: mint.publicKey,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID
      }),
      createInitializeMint2Instruction(
        mint.publicKey, 9, wallet, wallet, TOKEN_PROGRAM_ID
      )
    );
    tx.feePayer = wallet;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.partialSign(mint);
    const signed = await provider.signTransaction(tx);
    const sig = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(sig, "confirmed");
    $("mint").disabled = false;
    msg("Mint ساخته شد.\nMint Address:\n"+mint.publicKey.toBase58()+"\n\nSignature:\n"+sig+
        "\n\nاین نسخه Devnet است و ارزش مالی ندارد.");
  }catch(e){ msg("خطا در ساخت Mint:\n"+e.message); }
};

$("mint").onclick = async () => {
  if(!wallet || !mint) return;
  try{
    const ata = await getAssociatedTokenAddress(mint.publicKey, wallet);
    const info = await connection.getAccountInfo(ata);
    const tx = new Transaction();
    if(!info){
      tx.add(createAssociatedTokenAccountInstruction(wallet, ata, wallet, mint.publicKey));
    }
    const amount = 1_000_000_000n * 1_000_000_000n;
    tx.add(createMintToInstruction(mint.publicKey, ata, wallet, amount));
    tx.feePayer = wallet;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    const signed = await provider.signTransaction(tx);
    const sig = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(sig, "confirmed");
    msg("موفق! 1,000,000,000 NVDX روی Devnet Mint شد.\n"+
        "Mint Address:\n"+mint.publicKey.toBase58()+"\n\nSignature:\n"+sig);
  }catch(e){ msg("خطا در Mint:\n"+e.message); }
};
