
import {
  Stack,
  TextField,
  MenuItem,
} from "@mui/material";

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function formatMonthYear(value) {
  const [year, month] = value.split("-").map(Number);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return value;
  }

  return `${MONTHS[month - 1]} ${year}`;
}

export default function MonthYearSelector({
  value,
  onChange,
}) {
  const [selectedYear, selectedMonth] = value
    .split("-")
    .map(Number);

  const currentYear = new Date().getFullYear();

  const years = Array.from(
    { length: 11 },
    (_, index) => currentYear - 5 + index
  );

  // Preserve an existing selection outside the default range.
  if (!years.includes(selectedYear)) {
    years.push(selectedYear);
    years.sort((a, b) => a - b);
  }

  const handleMonthChange = (event) => {
    const month = String(event.target.value).padStart(2, "0");

    onChange(`${selectedYear}-${month}`);
  };

  const handleYearChange = (event) => {
    const year = Number(event.target.value);

    onChange(
      `${year}-${String(selectedMonth).padStart(2, "0")}`
    );
  };

  return (
    <Stack direction="row" spacing={1.5}>
      <TextField
        select
        label="Month"
        size="small"
        value={selectedMonth}
        onChange={handleMonthChange}
        sx={{ minWidth: 145 }}
      >
        {MONTHS.map((name, index) => (
          <MenuItem key={name} value={index + 1}>
            {name}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        label="Year"
        size="small"
        value={selectedYear}
        onChange={handleYearChange}
        sx={{ minWidth: 110 }}
      >
        {years.map((year) => (
          <MenuItem key={year} value={year}>
            {year}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}
