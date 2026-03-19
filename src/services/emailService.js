import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendReferralVisitNotification(recipient, visitInfo) {
  if (!resend) {
    console.log('Email service not configured (RESEND_API_KEY missing)');
    return;
  }

  const { address, short_code, recipient_name } = recipient;
  const { ip_address, user_agent, visited_at, visit_count } = visitInfo;

  try {
    await resend.emails.send({
      from: 'LowerPropTax <help@lowerproptax.com>',
      to: 'help@lowerproptax.com',
      subject: `Mailer Link Opened - ${address}`,
      text: `Someone visited a direct mail referral link:

Property: ${address}
Owner: ${recipient_name || 'Unknown'}
Short Code: ${short_code}
Link: lowerproptax.com/r/${short_code}
Visit #: ${visit_count}
Time: ${visited_at}
IP: ${ip_address || 'Unknown'}
User Agent: ${user_agent || 'Unknown'}
`
    });
    console.log(`Referral visit notification sent for ${short_code}`);
  } catch (error) {
    console.error('Failed to send referral visit notification:', error.message);
  }
}

export async function sendReportPurchasedNotification(recipient) {
  if (!resend) {
    console.log('Email service not configured (RESEND_API_KEY missing)');
    return;
  }

  const { recipient_name, address, email } = recipient;

  try {
    await resend.emails.send({
      from: 'LowerPropTax <help@lowerproptax.com>',
      to: 'help@lowerproptax.com',
      subject: `Report Purchased - ${address}`,
      text: `A property tax savings report was purchased:

Property: ${address}
Owner: ${recipient_name || 'Unknown'}
Email: ${email || 'Not provided'}
`
    });
    console.log(`Report purchased notification sent for ${address}`);
  } catch (error) {
    console.error('Failed to send report purchased notification:', error.message);
  }
}
