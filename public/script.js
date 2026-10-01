const appointmentForm = document.getElementById("appointmentForm");

appointmentForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    const formData = new FormData(appointmentForm);

    const appointment = {
        name: formData.get("name"),
        phone: formData.get("phone"),
        email: formData.get("email"),
        service: formData.get("service"),
        date: formData.get("date"),
        time: formData.get("time"),
        note: formData.get("note")
    };

    try {

        const response = await fetch("/api/appointments", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(appointment)
        });

        const result = await response.json();

        if (result.success) {

            alert("✅ Randevunuz başarıyla oluşturuldu!");

            appointmentForm.reset();

        } else {

            alert("❌ Randevu oluşturulamadı.");

        }

    } catch (error) {

        console.error(error);

        alert(
            "❌ Sunucuya bağlanılamadı. " +
            "Lütfen daha sonra tekrar deneyin."
        );

    }

});

