export const mergeDeep = (target: any, source: any): any => {

  /*
  // Example usage:
  const obj1 = {
    a: 1,
    b: {
      c: 2,
      d: 3
    }
  };

  const obj2 = {
    b: {
      c: 4,
      e: 5
    },
    f: 6
  };

  const mergedObj = mergeDeep(obj1, obj2);
  console.log(mergedObj);
  // Output: { a: 1, b: { c: 4, d: 3, e: 5 }, f: 6 }
  */

  const isObject = (obj: any) => obj && typeof obj === 'object';

  if (!isObject(target) || !isObject(source)) {
    return source;
  }

  Object.keys(source).forEach(key => {
    const targetValue = target[key];
    const sourceValue = source[key];

    if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
      target[key] = Array.from(new Set(targetValue.concat(sourceValue)));
    } else if (isObject(targetValue) && isObject(sourceValue)) {
      target[key] = mergeDeep(Object.assign({}, targetValue), sourceValue);
    } else {
      target[key] = sourceValue;
    }
  });

  return target;
}

