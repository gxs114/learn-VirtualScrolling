const $ = sel => document.querySelector(sel)
window.$ = $

class VirtualScroll {
  constructor(options) {
    // 是否是不定高度
    this.dynamicHeight = options.dynamicHeight ?? false
    // 每次加载的数量
    this.loadSize = options.loadSize ?? 10
    // 总共几条
    this.count = options.count
    // 高度
    this.height = options.height
    // 创建子节点
    this.createChild = options.createChild
    // 延时器
    this.timer = null
    //
    this.source = []
    this.list = []
    //
    this.isFirst = true
  }

  mount(target, style) {
    const main = document.createElement("div")
    main.classList.add("main")

    const container = document.createElement("div")
    container.classList.add("container")
    container.style.height = `${this.height * this.count}px`

    main.appendChild(container)
    Object.assign(main.style, style)
    target.appendChild(main)

    this.main = main
    this.container = container
    this.normalizeState()
    this.loadMore(this.source.slice(0, this.loadSize))

    return this
  }

  loadMore(data, up = false) {
    this.unObserver()
    this.loadItemElement(data, up)
    this.dynamicHeight
      ? this.loadWithDynamicHeight(data, up)
      : this.loadWithFixedHeight(data, up)
    this.startObserver()
  }

  loadWithFixedHeight(data, up) {
    const anchor = this.container.firstChild
    data.forEach(item => {
      item.el.style.top = `${item.index * this.height}px`
      item.el.style.height = this.height + "px"
      item.top = item.index * this.height
      up
        ? this.container.insertBefore(item.el, anchor)
        : this.container.appendChild(item.el)
    })
    this.list = up ? data.concat(this.list) : this.list.concat(data)
  }

  loadWithDynamicHeight(data, up) {
    const second = this.list[1]
    let clientTop = 0
    if (second) {
      clientTop = second.el.offsetTop - this.main.scrollTop
    }

    // 因为真实高度不确定，先插入到页面，之后在算实际的距离
    const anchor = this.container.firstChild
    data.forEach(item =>
      up
        ? this.container.insertBefore(item.el, anchor)
        : this.container.appendChild(item.el)
    )

    // 偏移量，计算真实元素相较于占位高度的总误差
    let offset = 0

    // 如果是初次加载 或者 向上加载
    // 两者的逻辑是重合的，都需要每次计算首个元素的真实位置，然后后边的所有元素都需要根据上一个做动态的调整
    if (this.isFirst || up) {
      this.list = data.concat(this.list)

      const first = this.list[0]
      const height = first.el.offsetHeight
      const top = first.index * this.height
      first.height = height
      first.top = top
      first.el.style.top = top + "px"
      offset = offset + height - this.height

      let nextTop = top + height
      for (let index = 1; index < this.list.length; index++) {
        const item = this.list[index]
        if (item.height) {
          if (item.top === nextTop) {
            break
          } else {
            item.top = nextTop
            item.el.style.top = nextTop + "px"
            nextTop += item.height
            continue
          }
        }

        const height = item.el.offsetHeight
        item.height = height
        item.top = nextTop
        item.el.style.top = nextTop + "px"
        nextTop = nextTop + height
        offset = offset + height - this.height
      }

      if (this.isFirst) {
        this.isFirst = false
        up = true
      }
    }

    // 处理向下添加的情况
    if (!up) {
      const last = this.list.at(-1)
      let nextTop = last.top + last.height

      this.list = this.list.concat(data)

      data.forEach(item => {
        const height = item.el.offsetHeight
        item.height = height
        item.top = nextTop
        item.el.style.top = nextTop + "px"
        nextTop = nextTop + height
        offset = offset + height - this.height
      })
    }

    this.container.style.height = `${this.count * this.height + offset}px`
    if (second) {
      this.main.scrollTop = second.el.offsetTop - clientTop
    }
  }

  loadItemElement(data, up) {
    const list = this.list
    if (up) {
      data.forEach((item, index) => {
        item.el = this.createChild(item.index, list[0].el)
      })
    } else {
      data.forEach((item, index) => {
        item.el = this.createChild(item.index)
      })
    }
  }

  scrollLoad(top) {
    this.list.forEach(item => {
      item.stopObserver && item.stopObserver()
      item.el.parentNode.removeChild(item.el)
      item.height = null
    })
    this.list = []
    this.main.scrollTop = top
    this.isFirst = true

    const topIndex = Math.floor(top / this.height) + 1
    const half = Math.floor(this.loadSize / 2)
    const start = topIndex - half < 0 ? 0 : topIndex - half
    const end = start + this.loadSize
    this.loadMore(this.source.slice(start, end))
  }

  startObserver() {
    const list = this.list
    const first = list[0]
    const last = list.at(-1)
    if (first.index !== 0) {
      first.stopObserver = this.observer(
        list[0].el,
        () => {
          console.log("up")
          const start = first.index - this.loadSize
          this.loadMore(
            this.source.slice(start < 0 ? 0 : start, first.index),
            true
          )
        },
        { root: this.main }
      )
    }

    if (last.index !== this.source.length - 1) {
      last.stopObserver = this.observer(
        list.at(-1).el,
        () => {
          console.log("bottom")
          this.loadMore(
            this.source.slice(last.index + 1, last.index + this.loadSize + 1)
          )
        },
        { root: this.main }
      )
    }
  }

  unObserver() {
    const list = this.list
    if (list.length > 2) {
      const first = list[0]
      const last = list.at(-1)
      first.stopObserver && first.stopObserver()
      first.stopObserver = null

      last.stopObserver && last.stopObserver()
      last.stopObserver = null
    }
  }

  observer(target, callback, options = {}) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          console.log(entries)
          callback(entry.target)
        }
      })
    }, options)

    observer.observe(target)
    return function stop() {
      observer.unobserve(target)
    }
  }

  normalizeState() {
    this.source = [...new Array(this.count)].map((_, index) => ({
      index,
      stopObserver: null,
      el: null,
      top: null,
      height: null
    }))
  }
}

// 基本使用，定高
const sc1 = new VirtualScroll({
  height: 60,
  count: 200,
  loadSize: 10,
  createChild(index) {
    const el = document.createElement("div")
    el.classList.add("item")
    el.innerHTML = `${index + 1}`
    return el
  }
})
sc1.mount(document.body, { height: "500px", width: "500px" })

// 基本使用，定高，滚动到指定位置
const sc2 = new VirtualScroll({
  height: 60,
  count: 200,
  loadSize: 10,
  createChild(index) {
    const el = document.createElement("div")
    el.classList.add("item")
    el.innerHTML = `${index + 1}`
    return el
  }
})
sc2.mount(document.body, { height: "500px", width: "500px" }).scrollLoad(1800)

// 不定高度
const sc3 = new VirtualScroll({
  dynamicHeight: true,
  height: 60,
  count: 200,
  loadSize: 10,
  createChild(index) {
    const el = document.createElement("div")
    el.classList.add("item")
    el.innerHTML = `${index + 1}`
    el.style.height = Math.floor(30 + Math.random() * 70) + "px"
    return el
  }
})
sc3.mount(document.body, { height: "500px", width: "500px" })

// 不定高度，滚动到指定位置
const sc4 = new VirtualScroll({
  dynamicHeight: true,
  height: 60,
  count: 200,
  loadSize: 10,
  createChild(index) {
    const el = document.createElement("div")
    el.classList.add("item")
    el.innerHTML = `${index + 1}`
    el.style.height = Math.floor(30 + Math.random() * 70) + "px"
    return el
  }
})
sc4.mount(document.body, { height: "500px", width: "500px" }).scrollLoad(1600)
