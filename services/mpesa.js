// services/mpesa.js — Safaricom Daraja M-PESA STK Push (Buy Goods / Till)
'use strict';

const CONSUMER_KEY    = process.env.MPESA_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const PASSKEY         = process.env.MPESA_PASSKEY;
const TILL_NUMBER     = process.env.MPESA_TILL || '4928849';
const SHORT_CODE      = TILL_NUMBER;          // same as till for Buy Goods
const IS_LIVE         = (process.env.MPESA_ENV || '').toLowerCase() === 'production';

const BASE_URL = IS_LIVE
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

async function getAccessToken() {
    const creds = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
    const res = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: { Authorization: `Basic ${creds}` },
    });
    if (!res.ok) throw new Error(`M-PESA OAuth failed: ${res.status}`);
    const data = await res.json();
    return data.access_token;
}

function timestamp() {
    return new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
}

function password(ts) {
    return Buffer.from(`${SHORT_CODE}${PASSKEY}${ts}`).toString('base64');
}

/**
 * Initiate STK Push — Buy Goods (Till Number).
 * @param {string} phone  - Customer phone in 254XXXXXXXXX format
 * @param {number} amount - Amount in KES (integer)
 * @param {string} ref    - AccountReference shown on customer prompt (max 12 chars)
 * @param {string} callbackUrl - Public HTTPS URL for result notification
 */
async function stkPush({ phone, amount, ref, callbackUrl }) {
    const token = await getAccessToken();
    const ts    = timestamp();
    const body  = {
        BusinessShortCode: SHORT_CODE,
        Password:          password(ts),
        Timestamp:         ts,
        TransactionType:   'CustomerBuyGoodsOnline',
        Amount:            Math.ceil(amount),
        PartyA:            phone,
        PartyB:            TILL_NUMBER,
        PhoneNumber:       phone,
        CallBackURL:       callbackUrl,
        AccountReference:  ref.slice(0, 12),
        TransactionDesc:   ref.slice(0, 13),
    };
    const res = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
    });
    const data = await res.json();
    if (data.ResponseCode !== '0') throw new Error(data.errorMessage || data.ResponseDescription);
    return data; // { MerchantRequestID, CheckoutRequestID, ResponseCode, ResponseDescription }
}

/**
 * Query STK Push status.
 */
async function stkQuery(checkoutRequestId) {
    const token = await getAccessToken();
    const ts    = timestamp();
    const res = await fetch(`${BASE_URL}/mpesa/stkpushquery/v1/query`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            BusinessShortCode: SHORT_CODE,
            Password:          password(ts),
            Timestamp:         ts,
            CheckoutRequestID: checkoutRequestId,
        }),
    });
    return res.json();
}

module.exports = { stkPush, stkQuery };
