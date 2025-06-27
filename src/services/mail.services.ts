import { createTransport } from 'nodemailer';
import Logger from '../config/logger';
import { MailInterface } from '../interfaces/mail.interfaces';

const transporter = createTransport({
	host: process.env.SMTP_HOST,
	port: Number(process.env.SMTP_PORT || 465),
	secure: true,
	auth: {
		user: process.env.SMTP_USERNAME,
		pass: process.env.SMTP_PASSWORD,
	},
});

export const sendCustomMail = async (mailOptions: MailInterface) => {
	try {
		const info = await transporter.sendMail(mailOptions);
		Logger.info(`Mail successfully sent to ${mailOptions.to}`);
		Logger.info('Message sent: %s', info);
	} catch (error) {
		Logger.info(`Error sending message to ${mailOptions.to}`);
		Logger.error('Error sending email:', error);
	}
};