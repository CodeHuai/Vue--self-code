// 弱引用，有利于内存
const bucket = new WeakMap()
// 被代理的对象
const data = {foo: 1}


const obj = new Proxy(data, {
  get(target, key) {
    // 收集依赖
    track(target, key)
    return target[key]
  },
  set(target, key, newValue, receiver) {
    target[key] = newValue
    // 把副作用函数从桶里取出并执行
    trigger(target, key)
  }
})

// 收集依赖
function track(target, key) {
  let depsMap = bucket.get(target)
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()))
  }
  let deps = depsMap.get(key) // 拿到的是一个 副作用函数的 Set 集合
  if (!deps) {
    depsMap.set(key, (deps = new Set()))
  }
  deps.add(activeEffect)
  // 副作用函数上面，始终有一个 deps 属性是作为收集key属性相关的副作用函数集合
  activeEffect.deps.push(deps)
}

// 执行收集的那些依赖
function trigger(target, key) {
  const depsMap = bucket.get(target)
  if (!depsMap) return
  const effects = depsMap.get(key)
  
  // 新创建一个 集合， 用来替代 effects， 免得一直对 effects操作，触发死循环
  const effectsToRun = new Set()
  // 拷贝一个, 注意 set 是没有 length 属性的
  if (effects) {
    effects.forEach(effectFn => {
      // 如果 trigger 触发执行的副作用函数与当前正在执行的副作用函数相同，则不触发执行,避免触发无限递归
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn)
      }
    })
  }
  effectsToRun.forEach(effectFn => effectFn())
}


// 存储当前激活的 effect 函数
let activeEffect = null
// effect 栈， 避免多个 副作用函数执行时， 在  activeEffect = effectFn 赋值语句这里时，后者替换前者
const effectStack = []

// 收集依赖其实就是收集副作用函数，并且副作用函数也通过装饰器进行了包装，保证内部还能再加点逻辑进去
function effect(fn) {
  // 实际上 fn 才是副作用函数， 但是经过 effectFn 的包装，effectFn 是我们使用中的 副作用函数
  const effectFn = () => {
    // 遍历effectFn.deps， 清空与当前副作用函数有关联的依赖，避免不必要的更新
    cleanup(effectFn)
    // 这里是闭包的使用， 在proxy 中的 getter 中， 收集依赖时（收集副作用函数时），就是直接添加 activeEffect，避免函数从执行栈中销毁了
    activeEffect = effectFn
    effectStack.push(effectFn)
    fn()
    effectStack.pop()
    // activeEffect保证 activeEffect 始终指向 栈顶副作用函数
    activeEffect = effectStack[effectStack.length - 1]
  }
  // 用来存储所有与该副作用函数相关的依赖集合, 都是一个个 副作用函数组成的集合Set，类似于 [new Set(), new Set(), ...]
  effectFn.deps = []
  effectFn()
}

// 遍历effectFn.deps， 清空与当前副作用函数有关联的依赖，避免不必要的更新
function cleanup(effectFn) {
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i]
    deps.delete(effectFn)
  }
  effectFn.deps.length = 0
}

effect(() => {
  console.log(obj.foo)
})
console.log('结束了')
