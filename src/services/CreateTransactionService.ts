import { getCustomRepository, getRepository } from 'typeorm';
import TransactionsRepository from '../repositories/TransactionsRepository';

// import AppError from '../errors/AppError';

import Transaction from '../models/Transaction';
import Category from '../models/Category';
import AppError from '../errors/AppError';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

interface RequesteCategory {
  title: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: Request): Promise<Transaction> {
    const transactionsrepository = getCustomRepository(TransactionsRepository);
    const objcategory = await this.findOrCreateCategory({ title: category });

    const { total } = await transactionsrepository.getBalance();
    if (type === 'outcome' && total < value) {
      throw new AppError('You do not have enough balance');
    }

    const transaction = transactionsrepository.create({
      title,
      type,
      value,
      category_id: objcategory.id,
      category: objcategory,
    });

    await transactionsrepository.save(transaction);

    return transaction;
  }

  private async findOrCreateCategory({
    title,
  }: RequesteCategory): Promise<Category> {
    const categoriesrepository = getRepository(Category);

    //verifica se existe categoria
    let category = await categoriesrepository.findOne({ where: { title } });

    if (!category) {
      //cria categoria
      category = categoriesrepository.create({ title });
      await categoriesrepository.save(category);
    }

    return category;
  }
}

export default CreateTransactionService;
