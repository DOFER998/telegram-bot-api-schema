import { defineEnum } from '#kit';

/**
 * A Message carries both content and bookkeeping fields. The enum is built by
 * subtraction: the exclusion list is shorter than the content list and barely
 * grows, so a new kind of message lands in the enum on its own.
 */
export default defineEnum('ContentType', {
  description: 'Kinds of content and service event a Message can carry.',
  extract: {
    from: 'Message',
    exclude: [
      'message_id',
      'message_thread_id',
      'direct_messages_topic',
      'from',
      'sender_chat',
      'sender_boost_count',
      'sender_business_bot',
      'sender_tag',
      'receiver_user',
      'ephemeral_message_id',
      'date',
      'guest_query_id',
      'business_connection_id',
      'chat',
      'forward_origin',
      'is_topic_message',
      'is_automatic_forward',
      'reply_to_message',
      'external_reply',
      'quote',
      'reply_to_story',
      'reply_to_checklist_task_id',
      'reply_to_poll_option_id',
      'via_bot',
      'guest_bot_caller_user',
      'guest_bot_caller_chat',
      'edit_date',
      'has_protected_content',
      'is_from_offline',
      'is_paid_post',
      'media_group_id',
      'author_signature',
      'paid_star_count',
      'entities',
      'link_preview_options',
      'suggested_post_info',
      'effect_id',
      'caption',
      'caption_entities',
      'show_caption_above_media',
      'has_media_spoiler',
      'reply_markup',
    ],
  },
});
