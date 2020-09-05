import parse from 'csv-parse';
import fs from 'fs';
import path from 'path';
import Transaction from '../models/Transaction';
import upload from '../config/upload';
import AppError from '../errors/AppError';
import Category from '../models/Category';
import { getRepository, In, getCustomRepository } from 'typeorm';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface Request {
  filepath: string;
}

interface TransactionDTO {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  private getTransactionsFromCSV(filepath: string): Promise<TransactionDTO[]> {
    const filePath = path.resolve(upload.directory, filepath);

    const csvReadStream = fs.createReadStream(filePath);

    const parsers = parse({ delimiter: ', ', from_line: 2 });

    const parsed = csvReadStream.pipe(parsers);

    fs.unlink(filePath, error => {
      if (error) throw error;
    });

    return new Promise((resolve, reject) => {
      const transactions: TransactionDTO[] = [];
      parsed
        .on('data', line => {
          const [title, type, value, category] = line;

          transactions.push({
            title,
            type,
            value,
            category,
          });
        })
        .on('error', () => {
          reject(new AppError('Error to read from csv file', 500));
        })
        .on('end', () => {
          resolve(transactions);
        });
    });
  }

  async execute({ filepath }: Request): Promise<Transaction[]> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);

    let transactions: TransactionDTO[] = [];

    transactions = await this.getTransactionsFromCSV(filepath);

    let categories: string[] = [];

    transactions.forEach(transaction => {
      categories.push(transaction.category);
    });

    const categorys = await this.findOrCreateCategory(categories);

    const createdtransactions = transactionsRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: categorys.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    await transactionsRepository.save(createdtransactions);

    return createdtransactions;
  }

  async findOrCreateCategory(categories: string[]): Promise<Category[]> {
    const categoriesrepository = getRepository(Category);

    //verifica se existe categoria
    let existentCategories = await categoriesrepository.find({
      where: {
        title: In(categories),
      },
    });

    const existentCategoriesTitles = existentCategories.map(
      (category: Category) => category.title,
    );

    const addCategoryTitles = categories
      .filter(category => !existentCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoriesrepository.create(
      addCategoryTitles.map(title => ({
        title,
      })),
    );

    await categoriesrepository.save(newCategories);

    return [...newCategories, ...existentCategories];
  }
}

export default ImportTransactionsService;
