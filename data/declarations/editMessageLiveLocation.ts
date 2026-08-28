import { defineMethod } from '#kit';

/**
 * The prose says the result depends on the message: "if the edited message is
 * not an inline message, the edited Message is returned, otherwise True is
 * returned". A regular expression can only pick one of the two, so both are
 * named here.
 */
export default defineMethod('editMessageLiveLocation', {
  returns: ['Message', 'True'],
});
