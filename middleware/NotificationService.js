import admin from 'firebase-admin';

class NotificationService {
    static async sendNotification(deviceToken, title, body) {
        const message = {
            notification: { title, body },
            token: deviceToken
        };
        try {
            const response = await admin.messaging().send(message);
            return response;
        } catch (error) {
            throw error;
        }
    }

    static async sendMultipleNotification(deviceTokens, title, body) {
        const message = {
            tokens: deviceTokens,
            notification: { title, body }
        };
        try {
            const response = await admin.messaging().sendEachForMulticast(message);
            return response;
        } catch (error) {
            throw error;
        }
    }
}

export default NotificationService;
