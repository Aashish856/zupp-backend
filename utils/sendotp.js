const sns = require('../config/sns');

function sendOTP(phoneNumber, otp) {
  const params = {
    Message: `Your ZUPP verification code is ${otp}`,
    PhoneNumber: `+91${phoneNumber}`
  };

  return sns.publish(params).promise();
}

module.exports = sendOTP;
