import BaseJoi from 'joi';
import sanitizeHTML from 'sanitize-html';

const extension = (joi) => ({
    type: 'string',
    base: joi.string(),
    messages: {
        'string.escapeHTML': '{{#label}} must not include HTML!'
    },
    rules: {
        escapeHTML: {
            validate(value, helpers) {
                const clean = sanitizeHTML(value, {
                    allowedTags: [],
                    allowedAttributes: {},
                });
                if(clean !== value) return helpers.error('string.escapeHTML', {value})
                return clean;
            }
        }
    }
});

const Joi = BaseJoi.extend(extension);

const userProfileJoiObject = Joi.object({
    firebase_id: Joi.string().required(),
    name: Joi.string().required(),
    email: Joi.string().required(),
    age: Joi.number().integer().min(0).required(),
    country: Joi.string().required(),
    state: Joi.string().required(),
    phone_number: Joi.number().integer().min(1000000000).max(9999999999).required()
});

const userHistoryJoiObject = Joi.object({
  firebase_id: Joi.string().required(),
  destinationName: Joi.array().items(String).default([]),
  hotelName: Joi.array().items(String).default([]),
  rating: Joi.array().items(Number).default([]),
  price: Joi.array().items(Number).default([]),
  daysStayed: Joi.array().items(Number).default([])
});


export {userProfileJoiObject, userHistoryJoiObject};
