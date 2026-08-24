export function friendlyError(code: unknown, t: (fa: string, en: string) => string) {
  const key = typeof code === "string" ? code : "";
  const messages: Record<string, [string, string]> = {
    AUTH_REQUIRED: ["برای ادامه وارد حساب کاربری‌تان شوید.", "Please sign in to continue."],
    INVALID_PREDICTION: ["نتیجه‌ی پیش‌بینی معتبر نیست.", "Please enter a valid prediction."],
    MATCH_NOT_FOUND: ["این مسابقه پیدا نشد. لطفاً دوباره تلاش کنید.", "This match could not be found. Please try again."],
    PREDICTION_LOCKED: ["مهلت ثبت پیش‌بینی این مسابقه تمام شده است.", "Predictions for this match are now closed."],
    TRANSFER_OWNERSHIP_FIRST: ["برای ترک یا جابه‌جایی باشگاه، ابتدا مالکیت را به یکی از اعضای دیگر منتقل کنید.", "Transfer ownership to another member before leaving or switching Clubs."],
    ALREADY_MEMBER: ["شما هم‌اکنون عضو این باشگاه هستید.", "You are already a member of this Club."],
    INVITATION_REVOKED_OR_INVALID: ["این لینک دعوت معتبر نیست یا منقضی شده است.", "This invitation link is invalid or has expired."],
    CLUB_NOT_FOUND: ["این باشگاه پیدا نشد.", "This Club could not be found."],
    CLUB_NOT_RECRUITING: ["این باشگاه در حال جذب عضو جدید نیست.", "This Club is not accepting new members right now."],
    REQUEST_ALREADY_PENDING: ["درخواست عضویت شما از قبل در حال بررسی است.", "Your membership request is already being reviewed."],
    PENDING_JOIN_REQUEST: ["یک درخواست عضویت در حال بررسی دارید.", "You already have a membership request under review."],
    USER_ALREADY_OWNS_CLUB: ["شما از قبل مالک یک باشگاه هستید.", "You already own a Club."],
    USER_ALREADY_IN_CLUB: ["شما از قبل عضو یک باشگاه هستید.", "You already belong to a Club."],
    OWNER_PERMISSION_REQUIRED: ["فقط مالک باشگاه می‌تواند این کار را انجام دهد.", "Only the Club owner can do this."],
    NEW_OWNER_MUST_BE_MEMBER: ["مالک جدید باید یکی از اعضای فعلی باشگاه باشد.", "The new owner must already be a Club member."],
    INVALID_CLUB_NAME: ["نام باشگاه را به شکل معتبر وارد کنید.", "Please enter a valid Club name."],
    CLUB_HAS_MEMBERS: ["تا وقتی اعضای دیگری در باشگاه هستند، حذف آن ممکن نیست.", "You cannot delete a Club while other members are still in it."],
  };
  const message = messages[key];
  return message ? t(message[0], message[1]) : t("عملیات انجام نشد. لطفاً دوباره تلاش کنید.", "Something went wrong. Please try again.");
}
