
const categoryRules = [
  {
    keywords: ["walmart", "costco", "nofrills", "loblaws", "freshco"],
    category: "Groceries",
  },
  {
    keywords: ["tim hortons", "starbucks", "mcdonald", "restaurant"],
    category: "Food & Dining",
  },
  {
    keywords: ["netflix", "spotify", "disney", "cineplex"],
    category: "Entertainment",
  },
  {
    keywords: ["shell", "esso", "petro", "uber", "presto"],
    category: "Transportation",
  },
  {
    keywords: ["rent", "landlord", "mortgage"],
    category: "Housing",
  },
  {
    keywords: ["rogers", "bell", "fido", "hydro"],
    category: "Utilities",
  },
];

export function categorizeTransaction(description, type) {
  if (type === "income") {
    const text = description.toLowerCase();

    if (text.includes("salary") || text.includes("payroll")) {
      return "Salary";
    }

    return "Other Income";
  }

  const text = description.toLowerCase();

  for (const rule of categoryRules) {
    if (rule.keywords.some((keyword) => text.includes(keyword))) {
      return rule.category;
    }
  }

  return "Other";
}
