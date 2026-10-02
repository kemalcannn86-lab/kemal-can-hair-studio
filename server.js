require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get(["/admin", "/admin/"], (req, res) => res.sendFile(path.join(__dirname, "public", "admin", "index.html")));

const APPOINTMENTS_FILE = "appointments.json";


// ========================================
// RANDEVULARI OKU
// ========================================

function getAppointments() {
    if (!fs.existsSync(APPOINTMENTS_FILE)) {
        return [];
    }

    try {
        const data = fs.readFileSync(
            APPOINTMENTS_FILE,
            "utf8"
        );

        if (!data.trim()) {
            return [];
        }

        return JSON.parse(data);
    } catch (error) {
        console.log("❌ Randevular okunamadı:", error.message);
        return [];
    }
}


// ========================================
// RANDEVULARI KAYDET
// ========================================

function saveAppointments(appointments) {
    fs.writeFileSync(
        APPOINTMENTS_FILE,
        JSON.stringify(appointments, null, 2)
    );
}


// ========================================
// SAAT KONTROLÜ
// 09:00 - 21:30
// 30 dakikalık aralıklar
// ========================================

function isValidAppointmentTime(time) {
    if (!/^\d{2}:\d{2}$/.test(time)) {
        return false;
    }

    const [hour, minute] = time.split(":").map(Number);

    const totalMinutes = hour * 60 + minute;

    const startTime = 9 * 60;       // 09:00
    const endTime = 21 * 60 + 30;   // 21:30

    if (totalMinutes < startTime || totalMinutes > endTime) {
        return false;
    }

    if (minute !== 0 && minute !== 30) {
        return false;
    }

    return true;
}


// ========================================
// TELEGRAM BİLDİRİMİ
// ========================================

async function sendTelegramMessage(appointment) {

    const botToken = process.env.BOT_TOKEN;
    const chatId = process.env.CHAT_ID;

    if (!botToken || !chatId) {
        console.log("❌ Telegram ayarları bulunamadı.");
        return;
    }

    const message =
`🔔 YENİ RANDEVU

👤 Müşteri: ${appointment.name}
📞 Telefon: ${appointment.phone}
📧 E-posta: ${appointment.email}
✂️ Hizmet: ${appointment.service}
📅 Tarih: ${appointment.date}
🕐 Saat: ${appointment.time}
📝 Açıklama: ${appointment.note || "Belirtilmedi"}

KEMAL CAN HAIR STUDIO`;

    try {

        const response = await fetch(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    chat_id: chatId,
                    text: message
                })
            }
        );

        const result = await response.json();

        if (result.ok) {
            console.log("✅ Telegram bildirimi gönderildi.");
        } else {
            console.log(
                "❌ Telegram hatası:",
                result.description
            );
        }

    } catch (error) {

        console.log(
            "❌ Telegram bağlantı hatası:",
            error.message
        );
    }
}


// ========================================
// YENİ RANDEVU OLUŞTUR
// ========================================

app.post("/api/appointments", async (req, res) => {

    const appointment = {

        id: Date.now(),

        name: req.body.name || "",
        phone: req.body.phone || "",
        email: req.body.email || "",
        service: req.body.service || "",
        date: req.body.date || "",
        time: req.body.time || "",
        note: req.body.note || "",

        createdAt: new Date().toISOString()
    };


    // ====================================
    // SAAT KONTROLÜ
    // ====================================

    if (!isValidAppointmentTime(appointment.time)) {

        console.log("");
        console.log("⚠️ GEÇERSİZ RANDEVU SAATİ");
        console.log("Saat:", appointment.time);

        return res.status(400).json({

            success: false,

            message:
                "Geçersiz saat. Randevular 09:00 ile 21:30 arasında ve 30 dakikalık aralıklarla oluşturulabilir."
        });
    }


    // ====================================
    // RANDEVULARI AL
    // ====================================

    const appointments = getAppointments();


    // ====================================
    // AYNI TARİH + AYNI SAAT KONTROLÜ
    // ====================================

    const existingAppointment =
        appointments.find(
            item =>
                item.date === appointment.date &&
                item.time === appointment.time
        );


    if (existingAppointment) {

        console.log("");
        console.log("⚠️ DOLU RANDEVU SAATİ");
        console.log("Tarih:", appointment.date);
        console.log("Saat:", appointment.time);

        return res.status(409).json({

            success: false,

            message:
                "Bu tarih ve saat için zaten bir randevu bulunmaktadır. Lütfen başka bir saat seçin."
        });
    }


    // ====================================
    // RANDEVUYU KAYDET
    // ====================================

    appointments.push(appointment);

    saveAppointments(appointments);


    // ====================================
    // TERMUX KONSOLUNA YAZ
    // ====================================

    console.log("");
    console.log("===============================");
    console.log("        YENİ RANDEVU");
    console.log("===============================");

    console.log("Müşteri:", appointment.name);
    console.log("Telefon:", appointment.phone);
    console.log("E-posta:", appointment.email);
    console.log("Hizmet:", appointment.service);
    console.log("Tarih:", appointment.date);
    console.log("Saat:", appointment.time);
    console.log("Açıklama:", appointment.note);

    console.log("===============================");


    // ====================================
    // TELEGRAM
    // ====================================

    await sendTelegramMessage(appointment);


    // ====================================
    // BAŞARILI
    // ====================================

    res.json({

        success: true,

        message:
            "Randevunuz başarıyla oluşturuldu."
    });
});


// ========================================
// ADMIN GİRİŞ KONTROLÜ
// ========================================

function checkAdminAuth(req, res, next) {

    const auth = req.headers.authorization;


    if (!auth) {

        return res.status(401).json({

            success: false,

            message:
                "Admin girişi gerekli."
        });
    }


    if (!auth.startsWith("Basic ")) {

        return res.status(401).json({

            success: false,

            message:
                "Geçersiz giriş."
        });
    }


    try {

        const encoded =
            auth.split(" ")[1];

        const decoded =
            Buffer
                .from(encoded, "base64")
                .toString("utf8");

        const separatorIndex =
            decoded.indexOf(":");

        const password =
            separatorIndex === -1
                ? ""
                : decoded.substring(
                    separatorIndex + 1
                );

        const correctPassword =
            process.env.ADMIN_PASSWORD;


        if (
            !correctPassword ||
            password !== correctPassword
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Şifre yanlış."
            });
        }


        next();

    } catch (error) {

        return res.status(401).json({

            success: false,

            message:
                "Giriş doğrulanamadı."
        });
    }
}


// ========================================
// ADMIN - RANDEVULARI GETİR
// ========================================

app.get(
    "/api/admin/appointments",
    checkAdminAuth,
    (req, res) => {

        const appointments =
            getAppointments();

        res.json({

            success: true,

            appointments
        });
    }
);


// ========================================
// ADMIN - RANDEVU SİL
// ========================================

app.delete(
    "/api/admin/appointments/:id",
    checkAdminAuth,
    (req, res) => {

        const appointmentId =
            Number(req.params.id);


        if (!Number.isFinite(appointmentId)) {

            return res.status(400).json({

                success: false,

                message:
                    "Geçersiz randevu ID."
            });
        }


        const appointments =
            getAppointments();


        const appointmentIndex =
            appointments.findIndex(
                item =>
                    Number(item.id) === appointmentId
            );


        if (appointmentIndex === -1) {

            return res.status(404).json({

                success: false,

                message:
                    "Randevu bulunamadı."
            });
        }


        const deletedAppointment =
            appointments[appointmentIndex];


        appointments.splice(
            appointmentIndex,
            1
        );


        saveAppointments(appointments);


        console.log("");
        console.log("🗑️ RANDEVU SİLİNDİ");

        console.log(
            "Müşteri:",
            deletedAppointment.name
        );

        console.log(
            "Tarih:",
            deletedAppointment.date
        );

        console.log(
            "Saat:",
            deletedAppointment.time
        );


        res.json({

            success: true,

            message:
                "Randevu başarıyla silindi."
        });
    }
);


// ========================================
// SUNUCUYU BAŞLAT
// ========================================

module.exports = app;
