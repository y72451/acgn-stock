'use strict';
import { Meteor } from 'meteor/meteor';
import { dbLog } from '../db/dbLog';
import { dbInstantMessage } from '../db/dbInstantMessage';
import { dbResourceLock } from '../db/dbResourceLock';
import { threadId } from './thread';

Meteor.startup(function() {
  Meteor.setInterval(handleInstantMessage, 5000);
});

function handleInstantMessage() {
  try {
    const instantMessageBulk = dbInstantMessage.rawCollection().initializeUnorderedBulkOp();
    let needExecute = false;
    dbResourceLock.insert({
      _id: 'instantMessage',
      threadId: threadId,
      task: 'handleInstantMessage',
      time: new Date()
    });
    const logIdList = [];
    dbLog
      .find(
        {
          resolve: false
        },
        {
          disableOplog: true
        }
      )
      .forEach((log) => {
        logIdList.push(log._id);
        const instantMessage = {
          type: log.logType,
          createdAt: log.createdAt,
          onlyForUsers: [],
          source: '!'
        };
        switch (log.logType) {
          //驗證通過不進即時訊息
          case '驗證通過': {
            return false;
          }
          case '發薪紀錄': {
            instantMessage.message = '系統向所有已驗證通過的使用者發給了' + log.price + '的薪水！';
            break;
          }
          case '創立公司': {
            instantMessage.message = log.username[0] + '發起了「' + log.companyName + '」的新公司創立計劃，誠意邀請有意者投資！';
            break;
          }
          case '參與投資': {
            instantMessage.message = log.username[0] + '向「' + log.companyName + '公司創立計劃」投資了$' + log.amount + '！';
            break;
          }
          case '創立失敗': {
            instantMessage.message = log.username.join('、') + '等人投資的「' + log.companyName + '公司創立計劃」由於投資人數不足失敗了，投資金額將全數返回！';
            break;
          }
          case '創立成功': {
            instantMessage.message = log.username.join('、') + '等人投資的「' + log.companyName + '公司創立計劃」成功了，該公司正式上市，初始股價為$' + log.price + '！';
            break;
          }
          case '創立得股': {
            instantMessage.onlyForUsers = log.username;
            instantMessage.message = '對「' + log.companyName + '公司創立計劃」的投資為你帶來了' + log.amount + '數量的公司股票！';
            break;
          }
          case '創立退款': {
            instantMessage.onlyForUsers = log.username;
            instantMessage.message = '從「' + log.companyName + '公司創立計劃」收回了$' + log.amount + '的投資退款！';
            break;
          }
          case '購買下單': {
            instantMessage.message = log.username[0] + '想要用每股$' + log.price + '的單價購買' + log.amount + '數量的「' + log.companyName + '」公司股票！';
            break;
          }
          case '販賣下單': {
            instantMessage.message = log.username[0] + '想要用每股$' + log.price + '的單價販賣' + log.amount + '數量的「' + log.companyName + '」公司股票！';
            break;
          }
          case '取消下單': {
            instantMessage.message = log.username[0] + '取消了以每股$' + log.price + '的單價' + log.message + log.amount + '數量的「' + log.companyName + '」公司股票的訂單！';
            break;
          }
          case '訂單完成': {
            instantMessage.onlyForUsers = log.username;
            instantMessage.message = '您以每股$' + log.price + '的單價' + log.message + log.amount + '數量的「' + log.companyName + '」公司股票的訂單已經全數交易完畢！';
            break;
          }
          case '公司釋股': {
            instantMessage.message = '由於股價持續高漲，「' + log.companyName + '」公司以$' + log.price + '的價格釋出了' + log.amount + '數量的股票到市場上以套取利潤！';
            break;
          }
          case '交易紀錄': {
            instantMessage.message = log.username[0] + '以$' + log.price + '的單價向' + (log.username[1] || '「' + log.companyName  + '」公司') + '購買了' + log.amount + '數量的「' + log.companyName + '」公司股票！';
            break;
          }
          case '辭職紀錄': {
            instantMessage.message = log.username[0] + '辭去了「' + log.companyName + '」公司的經理人職務！';
            break;
          }
          case '參選紀錄': {
            instantMessage.message = log.username[0] + '開始競選「' + log.companyName + '」公司的經理人職務！';
            break;
          }
          case '經理管理': {
            instantMessage.message = log.username[0] + '修改了「' + log.companyName + '」公司的資訊！';
            break;
          }
          case '推薦產品': {
            instantMessage.message = log.username[0] + '向「' + log.companyName + '」公司的一項產品投了一張推薦票，使其獲得了$' + log.price + '的營利額！';
            break;
          }
          //支持紀錄不進即時訊息
          case '支持紀錄': {
            return false;
          }
          case '就任經理': {
            let extraDescription = '';
            if (log.username[1] === '!none') {
              extraDescription = '成為了公司的經理人。';
            }
            else if (log.username[0] === log.username[1]) {
              extraDescription = '繼續擔任「' + log.companyName + '」公司的經理人職務。';
            }
            else {
              extraDescription = '取代了' + log.username[1] + '成為了「' + log.companyName + '」公司的經理人。';
            }

            return (
              log.username[0] + '在' + log.message + '商業季度' +
              (log.amount ? ('以' + log.amount + '數量的支持股份') : '') +
              '擊敗了所有競爭對手，' + extraDescription
            );
          }
          case '公司營利': {
            instantMessage.message = '「' + log.companyName + '」公司在本商業季度一共獲利$' + log.amount + '！';
            break;
          }
          case '營利分紅': {
            instantMessage.onlyForUsers = log.username;
            instantMessage.message = '你得到了「' + log.companyName + '」公司的分紅$' + log.amount + '！';
            break;
          }
          case '舉報公司': {
            instantMessage.message = log.username[0] + '以「' + log.message + '」理由舉報了「' + log.companyName + '」公司！';
            break;
          }
          case '舉報產品': {
            instantMessage.message = log.username[0] + '以「' + log.message + '」理由舉報了「' + log.companyName + '」公司的#' + log.productId + '產品！';
            break;
          }
          case '公司撤銷': {
            instantMessage.message = log.username[0] + '以「' + log.message + '」理由撤銷了「' + log.companyName + '」公司！';
            break;
          }
          case '取消資格': {
            instantMessage.message = log.username[0] + '以「' + log.message + '」理由取消了' + log.username[1] + '擔任經理人的資格！';
            break;
          }
          //免費得石不進即時訊息
          case '免費得石': {
            return false;
          }
        }
        instantMessageBulk.insert(instantMessage);
        needExecute = true;
      });
    //清除一分鐘前的即時訊息
    dbInstantMessage.remove({
      createdAt: {
        $lt: new Date( Date.now() - 60000)
      }
    });
    if (needExecute) {
      dbLog.update(
        {
          _id: {
            $in: logIdList
          }
        },
        {
          $set: {
            resolve: true
          }
        },
        {
          multi: true
        }
      );
      instantMessageBulk.execute();
    }
  }
  catch (e) {
    throw e;
  }
  finally {
    dbResourceLock.remove('instantMessage');
  }
}
