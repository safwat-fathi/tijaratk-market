export const merchantPasswordResetOtp = ({
  otp,
  expiresInMinutes,
}: {
  otp: string;
  expiresInMinutes: number;
}) => `
رمز إعادة تعيين كلمة مرور تجارتك هو: ${otp}

ينتهي الرمز خلال ${expiresInMinutes} دقائق.
إذا لم تطلب تغيير كلمة المرور، تجاهل هذه الرسالة.
`;
