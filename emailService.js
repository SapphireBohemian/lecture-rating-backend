require('dotenv').config();

const sgMail = require('@sendgrid/mail');

// Set your SendGrid API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY); // Make sure to set this in your environment variables

/**
 * Sends an email notification.
 * @param {string} to - Recipient email address.
 * @param {string} subject - Subject of the email.
 * @param {string} text - Plain text content of the email.
 * @param {string} html - HTML content of the email (optional).
 */
const sendEmail = async (to, subject, text, html) => {
    const msg = {
        to,
        from: 'sapphirebohemian@gmail.com', // Use your verified sender email address
        subject,
        text,
        html,
    };

    try {
        await sgMail.send(msg);
        console.log('Email sent successfully');
    } catch (error) {
        if (error.response) {
            console.error('Error sending email:', error.response.body);
        } else {
            console.error('Error sending email:', error.message);
        }
    }
};


module.exports = { sendEmail };
