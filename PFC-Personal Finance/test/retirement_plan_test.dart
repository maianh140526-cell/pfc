import 'package:finance_app/screens/retirement_plan_screen.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('tính mục tiêu nghỉ hưu có điều chỉnh lạm phát', () {
    final target = calculateRealRetirementTarget(
      totalMonthlyBudget: 30000000,
      inflationRatePercent: 4,
      years: 20,
    );

    expect(target, closeTo(19720108287.30, 0.01));
  });

  test('dò nhị phân tìm đúng lợi suất yêu cầu', () {
    final target = calculateRetirementFutureValue(
      currentSavings: 100000000,
      monthlyContribution: 5000000,
      annualRatePercent: 10,
      years: 20,
    );

    final rate = calculateRequiredReturnRate(
      targetAmount: target,
      currentSavings: 100000000,
      monthlyContribution: 5000000,
      years: 20,
    );

    expect(rate, closeTo(10, 0.000001));
  });

  test('trả về vô cực khi lợi suất 50 phần trăm vẫn không đủ', () {
    final rate = calculateRequiredReturnRate(
      targetAmount: 1000000000000,
      currentSavings: 0,
      monthlyContribution: 100000,
      years: 1,
    );

    expect(rate, double.infinity);
  });

  test('tìm mức góp để đưa lợi suất yêu cầu về 15 phần trăm', () {
    const target = 10000000000.0;
    final contribution = calculateRequiredMonthlyContribution(
      targetAmount: target,
      currentSavings: 200000000,
      annualRatePercent: 15,
      years: 20,
    );
    final futureValue = calculateRetirementFutureValue(
      currentSavings: 200000000,
      monthlyContribution: contribution,
      annualRatePercent: 15,
      years: 20,
    );

    expect(futureValue, closeTo(target, 0.01));
  });
}
