const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys")
const P = require("pino")
const fs = require("fs")

// ================= CONFIG =================
const dono = "554188972311@s.whatsapp.net" // EX: 5541999999999@s.whatsapp.net
// ==========================================

let antilink = false
let forca = null

// ================= SALDO PERSISTENTE =================
const saldoFile = "./saldo.json"

function carregarSaldo() {
    if (!fs.existsSync(saldoFile)) {
        fs.writeFileSync(saldoFile, JSON.stringify({}))
    }
    return JSON.parse(fs.readFileSync(saldoFile))
}

function salvarSaldo(data) {
    fs.writeFileSync(saldoFile, JSON.stringify(data, null, 2))
}

let saldo = carregarSaldo()
// ====================================================

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth")

    const sock = makeWASocket({
        auth: state,
        logger: P({ level: "silent" })
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message) return

        const from = msg.key.remoteJid
        const sender = msg.key.participant || from
        const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            ""

        // -------- ANTILINK AUTOMÁTICO --------
        if (antilink && text.includes("chat.whatsapp.com")) {
            await sock.groupParticipantsUpdate(from, [sender], "remove")
            return
        }

        if (!text.startsWith("!")) return

        const args = text.slice(1).trim().split(" ")
        const command = args.shift().toLowerCase()

        // ================= MENU =================
        if (command === "menu") {
            await sock.sendMessage(from, {
                text: `🤖 MENU

🎮 Jogos
!forca iniciar
!saldo
!apostar valor

🛡️ Moderação
!ban @membro
!kick @membro
!antilink on/off`
            })
        }

        // ================= FORCA =================
        if (command === "forca" && args[0] === "iniciar") {
            const palavras = ["abelha", "mosquito", "formiga", "borboleta"]
            const palavra = palavras[Math.floor(Math.random() * palavras.length)]

            forca = {
                palavra,
                exibicao: "_ ".repeat(palavra.length).trim(),
                tentativas: 6
            }

            await sock.sendMessage(from, {
                text: `🎮 FORCA INICIADA
Tema: Insetos
Palavra: ${forca.exibicao}
Chances: ${forca.tentativas}`
            })
        }

        if (forca && command.length === 1) {
            let letra = command
            let nova = ""

            for (let i = 0; i < forca.palavra.length; i++) {
                if (forca.palavra[i] === letra) {
                    nova += letra + " "
                } else {
                    nova += forca.exibicao.split(" ")[i] + " "
                }
            }

            if (!forca.palavra.includes(letra)) {
                forca.tentativas--
            }

            forca.exibicao = nova.trim()

            if (!forca.exibicao.includes("_")) {
                await sock.sendMessage(from, {
                    text: `🎉 Você venceu!
Palavra: ${forca.palavra}`
                })
                forca = null
                return
            }

            if (forca.tentativas <= 0) {
                await sock.sendMessage(from, {
                    text: `💀 Você perdeu!
Palavra: ${forca.palavra}`
                })
                forca = null
                return
            }

            await sock.sendMessage(from, {
                text: `Palavra: ${forca.exibicao}
Chances: ${forca.tentativas}`
            })
        }

        // ================= SALDO =================
        if (command === "saldo") {
            if (!saldo[sender]) saldo[sender] = 100
            salvarSaldo(saldo)

            await sock.sendMessage(from, {
                text: `💰 Seu saldo: ${saldo[sender]} moedas`
            })
        }

        // ================= APOSTAR =================
        if (command === "apostar") {
            if (!saldo[sender]) saldo[sender] = 100

            const valor = parseInt(args[0])
            if (!valor || valor <= 0) {
                await sock.sendMessage(from, { text: "Use: !apostar valor" })
                return
            }

            if (valor > saldo[sender]) {
                await sock.sendMessage(from, { text: "❌ Saldo insuficiente" })
                return
            }

            const ganhou = Math.random() < 0.5

            if (ganhou) {
                saldo[sender] += valor
                await sock.sendMessage(from, {
                    text: `🎉 GANHOU!
+${valor} moedas
Saldo: ${saldo[sender]}`
                })
            } else {
                saldo[sender] -= valor
                await sock.sendMessage(from, {
                    text: `💀 PERDEU!
-${valor} moedas
Saldo: ${saldo[sender]}`
                })
            }

            salvarSaldo(saldo)
        }

        // ================= ANTILINK =================
        if (command === "antilink" && sender === dono) {
            antilink = args[0] === "on"
            await sock.sendMessage(from, {
                text: `Antilink ${antilink ? "ativado" : "desativado"}`
            })
        }

        // ================= BAN / KICK =================
        if ((command === "ban" || command === "kick") && sender === dono) {
            const mentioned =
                msg.message.extendedTextMessage?.contextInfo?.mentionedJid
            if (!mentioned) return

            await sock.groupParticipantsUpdate(from, [mentioned[0]], "remove")
        }
    })

    sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
        if (connection === "close") {
            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !==
                DisconnectReason.loggedOut
            if (shouldReconnect) startBot()
        } else if (connection === "open") {
            console.log("🤖 BOT ONLINE 24H")
        }
    })
}

startBot()
