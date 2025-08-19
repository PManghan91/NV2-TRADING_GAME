// Market hours utilities
export interface MarketHours {
  isOpen: boolean;
  nextOpen?: Date;
  nextClose?: Date;
  timezone: string;
}

export const getMarketStatus = (): MarketHours => {
  const now = new Date();
  const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
  
  const day = easternTime.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const hour = easternTime.getHours();
  const minute = easternTime.getMinutes();
  const timeInMinutes = hour * 60 + minute;
  
  // Market hours: 9:30 AM - 4:00 PM EST (Monday-Friday)
  const marketOpen = 9 * 60 + 30; // 9:30 AM in minutes
  const marketClose = 16 * 60; // 4:00 PM in minutes
  
  const isWeekday = day >= 1 && day <= 5;
  const isDuringMarketHours = timeInMinutes >= marketOpen && timeInMinutes < marketClose;
  
  const isOpen = isWeekday && isDuringMarketHours;
  
  let nextOpen: Date | undefined;
  let nextClose: Date | undefined;
  
  if (isOpen) {
    // Market is open, next close is today at 4 PM
    nextClose = new Date(easternTime);
    nextClose.setHours(16, 0, 0, 0);
  } else {
    // Market is closed, find next open
    let nextOpenDay = new Date(easternTime);
    
    if (isWeekday && timeInMinutes < marketOpen) {
      // It's a weekday before market open - next open is today
      nextOpenDay.setHours(9, 30, 0, 0);
    } else {
      // Find next Monday-Friday
      let daysToAdd = 1;
      while (true) {
        const nextDay = new Date(easternTime);
        nextDay.setDate(nextDay.getDate() + daysToAdd);
        const nextDayOfWeek = nextDay.getDay();
        
        if (nextDayOfWeek >= 1 && nextDayOfWeek <= 5) {
          nextOpenDay = nextDay;
          nextOpenDay.setHours(9, 30, 0, 0);
          break;
        }
        daysToAdd++;
      }
    }
    
    nextOpen = nextOpenDay;
  }
  
  return {
    isOpen,
    nextOpen,
    nextClose,
    timezone: 'EST'
  };
};

export const formatTimeUntil = (date: Date): string => {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  
  if (diff <= 0) return 'Now';
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  
  return `${minutes}m`;
};