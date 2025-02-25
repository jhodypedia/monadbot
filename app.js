const TelegramBot = require('node-telegram-bot-api');
const Web3 = require('web3');

const token = '7638949469:AAGkpSs1Lj0fs7lgrlk7BODFYITrB19W_qI'; // Ganti dengan token bot Anda
const bot = new TelegramBot(token, { polling: true });
const providerUrl = 'https://testnet-rpc.monad.xyz/';
const web3 = new Web3(providerUrl);

const privateKey = 'xxxx'; // Ganti dengan private key wallet Anda
const account = web3.eth.accounts.privateKeyToAccount(privateKey);
const faucetWalletAddress = account.address;
const claimHistory = {};
const maxClaimAmount = 0.01; 
const channelUsername = '@kedaidrop';

function canClaim(userId) {
  const lastClaimTime = claimHistory[userId] || 0;
  return Date.now() - lastClaimTime >= 24 * 60 * 60 * 1000;
}

async function isUserMember(userId) {
  try {
    const chatMember = await bot.getChatMember(channelUsername, userId);
    return ['member', 'administrator', 'creator'].includes(chatMember.status);
  } catch (error) {
    console.error('Gagal memeriksa keanggotaan:', error);
    return false;
  }
}

async function sendNativeTokenToUser(userId, userAddress) {
  try {
    if (!canClaim(userId)) {
      return 'Anda sudah mengklaim token dalam 24 jam terakhir. Silakan coba lagi nanti.';
    }
    claimHistory[userId] = Date.now();
    const amountInWei = web3.utils.toWei(maxClaimAmount.toString(), 'ether');
    const tx = {
      from: faucetWalletAddress,
      to: userAddress,
      value: amountInWei,
      gas: 21000,
    };
    const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
    const sentTx = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    const txHash = sentTx.transactionHash;
    const explorerLink = `https://testnet.monadexplorer.com/tx/${txHash}`;

    return `✅ Berhasil mengirim ${maxClaimAmount} MON ke ${userAddress}!\n\n🔗 Lihat transaksi di Explorer:\n[Klik di sini](${explorerLink})`;
  } catch (error) {
    console.error('Error:', error);
    return '❌ Terjadi kesalahan saat mengirim token.';
  }
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `👋 Selamat datang di Faucet Monad!\n\nAnda bisa mengklaim **0.1 MON** gratis setiap 24 jam.\n\nNamun, sebelum klaim, Anda harus bergabung dengan channel berikut:\n👉 [Join Channel](https://t.me/${channelUsername.replace('@', '')})`;

  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ Saya sudah bergabung', callback_data: 'verify_membership' }],
      ],
    },
    parse_mode: 'Markdown',
  };

  bot.sendMessage(chatId, welcomeMessage, options);
});

bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;

  if (callbackQuery.data === 'verify_membership') {
    const isMember = await isUserMember(userId);

    if (!isMember) {
      bot.sendMessage(
        chatId,
        `🚨 Anda belum bergabung dengan channel! Silakan join terlebih dahulu:\n👉 [Join Channel](https://t.me/${channelUsername.replace('@', '')})`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    bot.sendMessage(chatId, '✅ Terima kasih telah bergabung! Silakan kirimkan alamat wallet Anda untuk menerima 0.1 MON.');
    
    bot.onText(/^(0x[a-fA-F0-9]{40})$/, async (msg) => {
      if (msg.chat.id !== chatId) return;
      const userAddress = msg.text.trim();
      const result = await sendNativeTokenToUser(userId, userAddress);
      bot.sendMessage(chatId, result, { parse_mode: 'Markdown' });
    });
  }
});

console.log('🤖 Bot Telegram sudah aktif dan berjalan...');
