import 'package:finance_app/models/category_model.dart';
import 'package:finance_app/services/category_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('lọc danh mục trùng tên cùng loại trước khi tạo dropdown', () {
    const categories = [
      CategoryModel(
        id: 'home-1',
        userId: 'user-1',
        name: 'Nhà cửa',
        icon: 'home',
        type: 'expense',
      ),
      CategoryModel(
        id: 'home-2',
        userId: 'user-1',
        name: 'Nhà cửa',
        icon: 'home',
        type: 'expense',
      ),
      CategoryModel(
        id: 'salary',
        userId: 'user-1',
        name: 'Lương',
        icon: 'payments',
        type: 'income',
      ),
    ];

    final result = uniqueCategoriesForType(categories, 'expense');

    expect(result, hasLength(1));
    expect(result.single.id, 'home-1');
    expect(result.single.name, 'Nhà cửa');
  });
}
