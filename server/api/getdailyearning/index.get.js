import { Prisma } from "@prisma/client";
import prisma from "~/server/db";
import isAuthenticated from "~/server/utils/isAuthenticated";

export default defineEventHandler(async (event) => {
  const { user } = await isAuthenticated(event, true);
  let levelAID = null;
  let levelBID = null;
  let levelDID = null;

  try {
    const userOrders = await prisma.order.findMany({
      where: {
        userId: user.id,
      },
    });

    const productIds = userOrders.map((order) => order.productId);
    const productData = await prisma.product.findMany({
      where: {
        id: {
          in: productIds,
        },
      },
    });
    // console.log("Product Data:", productData);

    let dailyProfitSum = 0;
    productData.forEach((product) => {
      const ordersCount = userOrders.filter(
        (order) => order.productId === product.id
      ).length;
      const dailyProfit = product.dayProfit;
      const productDailyProfit = dailyProfit * ordersCount;
      dailyProfitSum += productDailyProfit;
    });

    console.log("Daily Profit Sum:", dailyProfitSum);

    /*------------------- Start Add or update the earnings ------------*/

    const findEarning = await prisma.earnings.findMany({
      where: {
        userId: user.id,
      },
    });

    console.log("user in earnings", findEarning.amount);

    if (!findEarning.amount) {
      await prisma.earnings.create({
        data: {
          userId: user.id,
          amount: dailyProfitSum,
        },
      });
    } else {
      const date = new Date();
      date.setDate(date.getDate() - 1); // Subtract one day from the current date

      const earningsToUpdate = await prisma.earnings.findMany({
        where: {
          createdAt: {
            lte: date,
          },
        },
      });

      for (const earning of earningsToUpdate) {
        const updatedEarning = await prisma.earnings.update({
          where: {
            id: earning.id,
          },
          data: {
            amount: earning.amount + dailyProfitSum, // Double the amount
          },
        });

        console.log(`Earnings ${updatedEarning.id} doubled.`);
      }
    }

    /*------------------- End Add or update the earnings ------------*/

    /*------------------- Start Transfer Daily Earning to invitents ------------*/

    let total = Number(dailyProfitSum);

    const invitationUser = user.invitationId;

    if (invitationUser) {
      const updatedBalanceC = await prisma.user.update({
        where: {
          id: invitationUser,
          // Filter users based on the invitation code
        },
        data: {
          balance: {
            increment: new Prisma.Decimal((10 / 100) * total), // Set the balance field to the sum of existing value and new value
          },
        },
      });

      let addtoTeamB = await prisma.team.create({
        data: {
          userId: invitationUser,
          fromId: user.id,
          level: "B",
          amount: (10 / 100) * total,
        },
      });

      console.log("aliiiBBBB", addtoTeamB);

      const findBID = await prisma.user.findUnique({
        where: {
          id: invitationUser,
        },
      });
      levelBID = findBID?.invitationId;

      if (levelBID) {
        const updatedBalanceD = await prisma.user.update({
          where: {
            id: levelBID,
          },
          data: {
            balance: {
              increment: new Prisma.Decimal((5 / 100) * total), // Set the balance field to the sum of existing value and new value
            },
          },
        });

        let addtoTeamC = await prisma.team.create({
          data: {
            userId: levelBID,
            fromId: user.id,
            level: "C",
            amount: (5 / 100) * total,
          },
        });

        console.log("aliiiCCCC", addtoTeamC);
      }

      const findDID = await prisma.user.findUnique({
        where: {
          id: levelBID,
        },
      });
      levelDID = findDID?.invitationId;

      if (levelDID) {
        const updatedBalanceD = await prisma.user.update({
          where: {
            id: levelDID,
          },
          data: {
            balance: {
              increment: new Prisma.Decimal((2 / 100) * total), // Set the balance field to the sum of existing value and new value
            },
          },
        });

        let addtoTeamD = await prisma.team.create({
          data: {
            userId: levelDID,
            fromId: user.id,
            level: "D",
            amount: (2 / 100) * total,
          },
        });

        console.log("aliiiCCCC", addtoTeamD);
      }
    }

    /*------------------- End Transfer Daily Earning to invitents ------------*/

    return dailyProfitSum;
  } catch (e) {
    return createError({ statusCode: e.code, statusMessage: e.message });
  }
});
