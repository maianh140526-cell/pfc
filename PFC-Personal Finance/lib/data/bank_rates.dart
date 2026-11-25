class BankRate {
  const BankRate({
    required this.bank,
    required this.threeMonths,
    required this.sixMonths,
    required this.twelveMonths,
  });

  final String bank;
  final double threeMonths;
  final double sixMonths;
  final double twelveMonths;

  double rateForMonths(int months) {
    switch (months) {
      case 3:
        return threeMonths;
      case 6:
        return sixMonths;
      case 12:
        return twelveMonths;
      default:
        throw ArgumentError.value(months, 'months', 'Kỳ hạn không hỗ trợ');
    }
  }
}

// Dữ liệu tĩnh tham khảo tháng 09/2026, không phải dữ liệu thời gian thực.
// Cần kiểm tra nguồn chính thức của từng ngân hàng và cập nhật định kỳ.
const bankRatesSeptember2026 = <BankRate>[
  BankRate(
      bank: 'Vietcombank',
      threeMonths: 4.75,
      sixMonths: 6.6,
      twelveMonths: 6.8),
  BankRate(bank: 'BIDV', threeMonths: 4.75, sixMonths: 6.6, twelveMonths: 6.8),
  BankRate(
      bank: 'VietinBank', threeMonths: 4.75, sixMonths: 6.6, twelveMonths: 6.8),
  BankRate(
      bank: 'Agribank', threeMonths: 4.75, sixMonths: 6.6, twelveMonths: 6.8),
  BankRate(bank: 'ACB', threeMonths: 4.75, sixMonths: 7.6, twelveMonths: 7.8),
  BankRate(
      bank: 'Sacombank', threeMonths: 4.75, sixMonths: 7.2, twelveMonths: 7.5),
  BankRate(
      bank: 'Techcombank', threeMonths: 4.7, sixMonths: 6.5, twelveMonths: 6.8),
  BankRate(bank: 'MB', threeMonths: 4.7, sixMonths: 6.5, twelveMonths: 6.8),
  BankRate(bank: 'VPBank', threeMonths: 4.7, sixMonths: 6.5, twelveMonths: 6.8),
];
