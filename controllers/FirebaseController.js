import NotificationService from "../middleware/NotificationService.js";

const sendFirebaseNotification = async (req, res) => {
    try {
        const { title, body, deviceToken } = req.body;
        if (!deviceToken) {
            return res.status(400).json({ message: "Device token is required", success: false });
        }

        try {
            await NotificationService.sendNotification(deviceToken, title, body);
            res.status(200).json({ message: "Notification sent successfully", success: true });
        } catch (error) {
            if (error.code === 'messaging/registration-token-not-registered') {
                return res.status(400).json({ message: "Token expired, request a new one", success: false });
            }
            throw error;
        }
    } catch (error) {
        res.status(500).json({ message: "Error sending notification", success: false, error: error.message });
    }
};


const sendMultipleFirebaseNotification = async (req, res) => {
    try {
        console.log("Received multiple notification request:", req.body);
        const { title, body, deviceTokens } = req.body;

        if (!deviceTokens || !Array.isArray(deviceTokens) || deviceTokens.length === 0) {
            return res.status(400).json({ message: "Device tokens must be a non-empty array", success: false });
        }

        await NotificationService.sendMultipleNotification(deviceTokens, title, body);
        res.status(200).json({ message: "Notifications sent successfully", success: true });
    } catch (error) {
        res.status(500).json({ message: "Error sending notifications", success: false, error: error.message });
    }
};

async function sendEveryMinuteNotification() {
    try {
        const title = "Every Minute Notification";
        const body = "Hello Body";
        const deviceToken = "cBz-tU6ZtkxKlWG-zZ8Tdh:APA91bHpit5kmF_WkXbdnfJM-GwAaPjP0ZyW5VGpo7Sl5J8H8BnwF9rk7PRXctEiB7H3nwOA7GmhLUnBy-BOCo9AOHAmecYr3WXgH_0a5vXXfeVL0SZmrB4";

        console.log("Sending scheduled notification...");
        await NotificationService.sendNotification(deviceToken, title, body);
    } catch (error) {
        console.error("Error in scheduled notification:", error.message);
    }
}

export { sendFirebaseNotification, sendMultipleFirebaseNotification, sendEveryMinuteNotification };