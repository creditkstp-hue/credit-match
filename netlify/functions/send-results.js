exports.handler = async (event) => {
  try {
    const { email, firstName, score, recommendations } = JSON.parse(event.body);

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sender: {
          name: "Credit Match",
          email: "creditkstp@gmail.com"
        },
        to: [
          {
            email: email,
            name: firstName
          }
        ],
        subject: "Your Credit Match Results",
        htmlContent: `
          <h2>Hello ${firstName},</h2>
          <p>Your Credit Match profile has been processed.</p>

          <p><strong>Estimated Score:</strong> ${score}</p>

          <pre style="white-space:pre-wrap;">${recommendations}</pre>

          <p>Thank you for using Credit Match.</p>
        `
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: data
        })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: err.message
      })
    };
  }
};
