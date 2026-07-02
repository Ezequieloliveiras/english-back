const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

export const calculateNextReviewDate = (hits: number, wasCorrect: boolean) => {
  const now = new Date();

  if (!wasCorrect) {
    return addDays(now, 1);
  }

  if (hits >= 5) {
    return addDays(now, 30);
  }

  if (hits >= 3) {
    return addDays(now, 7);
  }

  return addDays(now, 3);
};
