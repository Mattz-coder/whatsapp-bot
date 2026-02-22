const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, downloadContentFromMessage } = require("@whiskeysockets/baileys")
const P = require("pino")
const QRCode = require("qrcode")
const fs = require("fs")

// ================= CONFIG =================
const DB_FILE = "database.json"
const ADM_FILE = "admins.json"

function loadDB() {
    if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "{}")
    return JSON.parse(fs.readFileSync(DB_FILE))
}

function saveDB(db) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2))
}

function getUser(db, id) {
    if (!db[id]) db[id] = { coins: 100, wins: 0, msgs: 0 }
    return db[id]
}

function isAdmin(id) {
    if (!fs.existsSync(ADM_FILE)) return false
    const admins = JSON.parse(fs.readFileSync(ADM_FILE))
    return admins.includes(id.replace("@s.whatsapp.net", ""))
}

const jogosForca = {}
const palavras = ["javascript", "railway", "whatsapp", "nodejs", "bot"]

const spamControl = {}

async function startBot() {

    const { state, saveCreds } = await useMultiFileAuthState("auth")
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        logger: P({ level: "silent" })
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", async ({ connection, qr }) => {

        if (qr) {
            const qrBase64 = await QRCode.toDataURL(qr)
            console.log("\nAbra no navegador:\n")
            console.log(qrBase64)
        }

        if (connection === "open") console.log("BOT ONLINE 🚀")
        if (connection === "close") startBot()
    })

    sock.ev.on("messages.upsert", async ({ messages }) => {

        const msg = messages[0]
        if (!msg.message) return

        const from = msg.key.remoteJid
        const sender = msg.key.participant || msg.key.remoteJid

        const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            ""

        const command = text.toLowerCase().trim()

        // 🔕 SOMENTE COMANDOS
        if (!command.startsWith("!")) return

        // 🛡 ANTISPAM
        if (!spamControl[sender]) spamControl[sender] = 0
        spamControl[sender]++
        if (spamControl[sender] > 6) {
            await sock.sendMessage(from, { text: "⚠️ Anti-spam ativo. Aguarde..." })
            setTimeout(() => spamControl[sender] = 0, 5000)
            return
        }

        const db = loadDB()
        const user = getUser(db, sender)
        user.msgs++

        // ================= MENU =================
        if (command === "!menu") {
            await sock.sendMessage(from, {
                text:
`🤖 MENU

💰 !saldo
🏆 !top

🎮 !forca
🎲 !roleta 10

🖼 !sticker

👑 !addcoins 100`
            })
        }

        // ================= SALDO =================
        else if (command === "!saldo") {
            await sock.sendMessage(from, { text: `💰 Saldo: ${user.coins} moedas` })
        }

        // ================= RANKING =================
        else if (command === "!top") {

            const ranking = Object.entries(db)
                .sort((a, b) => b[1].coins - a[1].coins)
                .slice(0, 5)

            let txt = "🏆 TOP JOGADORES\n\n"

            ranking.forEach((u, i) => {
                txt += `${i + 1}º — ${u[1].coins} moedas\n`
            })

            await sock.sendMessage(from, { text: txt })
        }

        // ================= ROLETA =================
        else if (command.startsWith("!roleta")) {

            const valor = parseInt(command.split(" ")[1])
            if (!valor || valor <= 0)
                return await sock.sendMessage(from, { text: "Use: !roleta 10" })

            if (user.coins < valor)
                return await sock.sendMessage(from, { text: "❌ Saldo insuficiente" })

            const tiro = Math.floor(Math.random() * 6)

            if (tiro === 0) {
                user.coins -= valor
                await sock.sendMessage(from, { text: `💀 BANG! Perdeu ${valor}` })
            } else {
                user.coins += valor
                user.wins++
                await sock.sendMessage(from, { text: `😎 Sobreviveu! Ganhou ${valor}` })
            }
        }

        // ================= FORCA =================
        else if (command === "!forca") {

            const palavra = palavras[Math.floor(Math.random() * palavras.length)]

            jogosForca[sender] = {
                palavra,
                letras: [],
                erros: 0
            }

            await sock.sendMessage(from, {
                text: `🎮 FORCA\n\n${"_ ".repeat(palavra.length)}`
            })
        }

        else if (jogosForca[sender] && command.length === 2) {

            const jogo = jogosForca[sender]
            const letra = command.replace("!", "")

            if (!jogo.palavra.includes(letra)) jogo.erros++
            else jogo.letras.push(letra)

            let exibicao = ""
            for (let l of jogo.palavra) {
                exibicao += jogo.letras.includes(l) ? l + " " : "_ "
            }

            if (!exibicao.includes("_")) {
                user.coins += 20
                await sock.sendMessage(from, { text: `🏆 Venceu! +20 moedas\nPalavra: ${jogo.palavra}` })
                delete jogosForca[sender]
            }

            else if (jogo.erros >= 6) {
                await sock.sendMessage(from, { text: `💀 Perdeu! Palavra: ${jogo.palavra}` })
                delete jogosForca[sender]
            }

            else {
                await sock.sendMessage(from, { text: `🎮 ${exibicao}\nErros: ${jogo.erros}/6` })
            }
        }

        // ================= STICKER =================
        else if (command === "!sticker") {

            let imageMessage =
                msg.message.imageMessage ||
                msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage

            if (!imageMessage)
                return await sock.sendMessage(from, { text: "Envie ou responda uma imagem com !sticker" })

            const stream = await downloadContentFromMessage(imageMessage, "image")

            let buffer = Buffer.from([])
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk])
            }

            await sock.sendMessage(from, { sticker: buffer })
        }

        // ================= ADMIN =================
        else if (command.startsWith("!addcoins") && isAdmin(sender)) {

            const valor = parseInt(command.split(" ")[1]) || 100
            user.coins += valor

            await sock.sendMessage(from, { text: `👑 Admin adicionou ${valor} moedas` })
        }

        saveDB(db)
    })
}

startBot()
